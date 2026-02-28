/**
 * Accounts layer backed by Supabase (accounts, organizations, subscriptions, account_permissions).
 * Used when SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.
 */
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

let _client = null;

function getSupabase() {
  if (!_client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required");
    _client = createClient(url, key);
  }
  return _client;
}

/** Random 9-digit integer in [100000000, 999999999] that does not exist in accounts. Retries up to 10 times. */
export async function generateUniquePublicId() {
  const supabase = getSupabase();
  for (let i = 0; i < 10; i++) {
    const id = Math.floor(100000000 + Math.random() * 900000000);
    const { data } = await supabase.from("accounts").select("id").eq("public_id", id).maybeSingle();
    if (!data) return id;
  }
  throw new Error("Could not generate unique public_id");
}

function rowToUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    orgId: row.org_id,
    username: row.username,
    passwordHash: row.password_hash,
    resetCodeHash: row.reset_code_hash,
    role: row.role,
    displayName: row.display_name,
    publicId: row.public_id ?? null,
  };
}

export async function findUserByUsername(username) {
  const key = String(username ?? "").trim().toLowerCase();
  const { data, error } = await getSupabase()
    .from("accounts")
    .select("*")
    .ilike("username", key)
    .maybeSingle();
  if (error) return null;
  return rowToUser(data);
}

export async function findUserById(userId) {
  const { data, error } = await getSupabase().from("accounts").select("*").eq("id", userId).maybeSingle();
  if (error) return null;
  return rowToUser(data);
}

/** Get public_id for an account (for tips fallback when JWT user has no publicId). */
export async function getPublicIdByAccountId(accountId) {
  if (!accountId) return null;
  const { data, error } = await getSupabase()
    .from("accounts")
    .select("public_id")
    .eq("id", accountId)
    .maybeSingle();
  if (error || !data) return null;
  return data.public_id ?? null;
}

export async function verifyPassword(user, password) {
  if (!user?.passwordHash) return false;
  return bcrypt.compare(String(password ?? ""), user.passwordHash);
}

export async function getOrgById(orgId) {
  const { data, error } = await getSupabase().from("organizations").select("id, name, slug").eq("id", orgId).maybeSingle();
  if (error || !data) return null;
  return { id: data.id, name: data.name, slug: data.slug };
}

/** Oadmin username for the org (for Ouser profile display). */
export async function getOadminUsernameForOrg(orgId) {
  const { data, error } = await getSupabase()
    .from("accounts")
    .select("username")
    .eq("org_id", orgId)
    .eq("role", "oadmin")
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data.username ?? null;
}

/** List Ouser accounts in the org (for Oadmin settings). */
export async function listOusersByOrgId(orgId) {
  const { data, error } = await getSupabase()
    .from("accounts")
    .select("id, username, display_name, role, public_id")
    .eq("org_id", orgId)
    .eq("role", "ouser")
    .order("username");
  if (error) return [];
  return (data || []).map((r) => ({
    id: r.id,
    username: r.username,
    displayName: r.display_name,
    role: r.role,
    publicId: r.public_id ?? null,
  }));
}

/** Set Ouser permissions. permissions = { moduleKey: "read"|"read_write" }. Replaces existing. */
export async function setOuserPermissions(accountId, permissions) {
  const obj = permissions && typeof permissions === "object" ? permissions : {};
  const { error: delErr } = await getSupabase().from("account_permissions").delete().eq("account_id", accountId);
  if (delErr) return { ok: false, error: delErr.message };
  const entries = Object.entries(obj).filter(([, v]) => v === "read" || v === "read_write");
  if (entries.length === 0) return { ok: true };
  const rows = entries.map(([module_key, permission]) => ({
    account_id: accountId,
    module_key,
    permission,
  }));
  const { error: insErr } = await getSupabase().from("account_permissions").insert(rows);
  return insErr ? { ok: false, error: insErr.message } : { ok: true };
}

export async function getSubscription(orgId) {
  const { data, error } = await getSupabase()
    .from("subscriptions")
    .select("*")
    .eq("org_id", orgId)
    .eq("status", "active")
    .maybeSingle();
  if (error || !data) return null;
  return {
    orgId: data.org_id,
    plan: data.plan,
    duration: data.duration,
    status: data.status,
    startedAt: data.started_at,
    endsAt: data.ends_at,
  };
}

/** Same as getSubscription but returns subscription regardless of status (for /me and expiry check). */
export async function getSubscriptionAnyStatus(orgId) {
  const { data, error } = await getSupabase()
    .from("subscriptions")
    .select("*")
    .eq("org_id", orgId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id,
    orgId: data.org_id,
    plan: data.plan,
    duration: data.duration,
    status: data.status,
    startedAt: data.started_at,
    endsAt: data.ends_at,
  };
}

/** Update subscription (for CLI: cancel-plan, renew-subscription). */
export async function updateSubscription(orgId, patch) {
  const updates = { updated_at: new Date().toISOString() };
  if (patch.status !== undefined) updates.status = patch.status;
  if (patch.plan !== undefined) updates.plan = patch.plan;
  if (patch.duration !== undefined) updates.duration = patch.duration;
  if (patch.started_at !== undefined) updates.started_at = patch.started_at;
  if (patch.ends_at !== undefined) updates.ends_at = patch.ends_at;
  const { error } = await getSupabase()
    .from("subscriptions")
    .update(updates)
    .eq("org_id", orgId);
  if (error) throw new Error(error.message);
  return getSubscriptionAnyStatus(orgId);
}

export async function getOuserModulePermissionsForPlan(userId, enabledModuleKeys) {
  const { data: rows } = await getSupabase()
    .from("account_permissions")
    .select("module_key, permission")
    .eq("account_id", userId)
    .in("permission", ["read", "read_write"]);
  if (!rows || rows.length === 0) return {};
  const allowed = new Set(enabledModuleKeys);
  const result = {};
  for (const r of rows) {
    if (allowed.has(r.module_key) && (r.permission === "read" || r.permission === "read_write")) {
      result[r.module_key] = r.permission;
    }
  }
  return result;
}

export async function updateUsername(userId, newUsername) {
  const newKey = String(newUsername ?? "").trim();
  if (!newKey) return { ok: false, error: "اسم المستخدم الجديد مطلوب." };
  const { data: existing } = await getSupabase().from("accounts").select("id, username").eq("id", userId).maybeSingle();
  if (!existing) return { ok: false, error: "المستخدم غير موجود." };
  if (existing.username.toLowerCase() === newKey.toLowerCase()) return { ok: true };
  const { data: conflict } = await getSupabase().from("accounts").select("id").ilike("username", newKey).maybeSingle();
  if (conflict) return { ok: false, error: "اسم المستخدم هذا مستخدم بالفعل." };
  const { error } = await getSupabase().from("accounts").update({ username: newKey, updated_at: new Date().toISOString() }).eq("id", userId);
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Verify secret code (same as password reset) then update username. */
export async function validateSecretCodeAndUpdateUsername(userId, secretCode, newUsername) {
  const user = await findUserById(userId);
  if (!user) return { ok: false, error: "المستخدم غير موجود." };
  if (!user.resetCodeHash) return { ok: false, error: "الرمز السري غير مفعّل لهذا الحساب." };
  const valid = await bcrypt.compare(String(secretCode ?? ""), user.resetCodeHash);
  if (!valid) return { ok: false, error: "الرمز السري غير صحيح." };
  return updateUsername(userId, newUsername);
}

export async function validateResetCodeAndSetPassword(username, resetCode, newPassword) {
  const user = await findUserByUsername(username);
  if (!user) return { ok: false, error: "اسم المستخدم غير موجود." };
  if (!user.resetCodeHash) return { ok: false, error: "رمز إعادة التعيين غير مفعّل لهذا الحساب." };
  const valid = await bcrypt.compare(String(resetCode ?? ""), user.resetCodeHash);
  if (!valid) return { ok: false, error: "رمز إعادة التعيين غير صحيح." };
  const plain = String(newPassword ?? "").trim();
  if (plain.length < 4) return { ok: false, error: "كلمة المرور الجديدة يجب أن تكون 4 أحرف على الأقل." };
  const passwordHash = await bcrypt.hash(plain, 10);
  const { error } = await getSupabase()
    .from("accounts")
    .update({ password_hash: passwordHash, updated_at: new Date().toISOString() })
    .eq("id", user.id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function createUser(username, plainPassword, { orgId, role = "ouser", displayName } = {}) {
  const u = String(username ?? "").trim();
  if (!u) return { ok: false, error: "اسم المستخدم مطلوب." };
  const p = String(plainPassword ?? "").trim();
  if (p.length < 4) return { ok: false, error: "كلمة المرور يجب أن تكون 4 أحرف على الأقل." };
  if (!orgId) return { ok: false, error: "المؤسسة مطلوبة." };
  const { data: conflict } = await getSupabase().from("accounts").select("id").ilike("username", u).maybeSingle();
  if (conflict) return { ok: false, error: "اسم المستخدم مستخدم بالفعل." };
  const publicId = await generateUniquePublicId();
  const resetCode = String(Math.floor(100000 + Math.random() * 900000));
  const passwordHash = await bcrypt.hash(p, 10);
  const resetCodeHash = await bcrypt.hash(resetCode, 10);
  const { data: inserted, error } = await getSupabase()
    .from("accounts")
    .insert({
      org_id: orgId,
      username: u,
      password_hash: passwordHash,
      reset_code_hash: resetCodeHash,
      role: role || "ouser",
      display_name: displayName || u,
      public_id: publicId,
    })
    .select("id, username, org_id, role, display_name, public_id")
    .single();
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    user: {
      id: inserted.id,
      username: inserted.username,
      orgId: inserted.org_id,
      role: inserted.role,
      displayName: inserted.display_name,
      publicId: inserted.public_id ?? publicId,
    },
    resetCode,
  };
}
