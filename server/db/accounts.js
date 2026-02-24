/**
 * Accounts — organizations, subscriptions, Oadmin/Ouser (in-memory).
 * Passwords and reset codes stored hashed only (bcryptjs).
 */
import bcrypt from "bcryptjs";
import crypto from "crypto";

const now = () => new Date().toISOString();
const SALT_ROUNDS = 10;

/** Generate a random 6-digit secret code (numeric string). */
function generateSixDigitCode() {
  return String(crypto.randomInt(100000, 1000000));
}

/** Generate a random password (8 alphanumeric chars). */
function generateRandomPassword() {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < 8; i++) {
    s += chars[crypto.randomInt(0, chars.length)];
  }
  return s;
}

// ——— In-memory state ———
const orgs = new Map();
const users = new Map(); // key: username (lowercase)
const subscriptions = new Map(); // key: orgId
const addons = new Map(); // key: orgId -> Set of addon_key
const ouserPermissions = new Map(); // key: userId -> Record<moduleKey, 'no_access'|'read'|'read_write'>

// ——— Const organizations ———
export const ORG_IDS = Object.freeze({
  BASIC: "org-basic",
  PLUS: "org-plus",
  PRO: "org-pro",
});

export const ORGANIZATIONS = Object.freeze([
  { id: ORG_IDS.BASIC, name: "حساب أساسي (Basic)", slug: "basic-org", plan: "basic", duration: "yearly", addonOuser: false },
  { id: ORG_IDS.PLUS, name: "حساب بلس (Plus)", slug: "plus-org", plan: "plus", duration: "yearly", addonOuser: false },
  { id: ORG_IDS.PRO, name: "حساب برو (Pro)", slug: "pro-org", plan: "pro", duration: "yearly", addonOuser: true },
]);

orgs.set(ORG_IDS.BASIC, { id: ORG_IDS.BASIC, name: ORGANIZATIONS[0].name, slug: ORGANIZATIONS[0].slug, createdAt: now(), updatedAt: now() });
orgs.set(ORG_IDS.PLUS, { id: ORG_IDS.PLUS, name: ORGANIZATIONS[1].name, slug: ORGANIZATIONS[1].slug, createdAt: now(), updatedAt: now() });
orgs.set(ORG_IDS.PRO, { id: ORG_IDS.PRO, name: ORGANIZATIONS[2].name, slug: ORGANIZATIONS[2].slug, createdAt: now(), updatedAt: now() });

addons.set(ORG_IDS.BASIC, new Set(["ouser"]));
addons.set(ORG_IDS.PLUS, new Set());
addons.set(ORG_IDS.PRO, new Set(["ouser"]));

subscriptions.set(ORG_IDS.BASIC, { orgId: ORG_IDS.BASIC, plan: "basic", duration: "yearly", status: "active", startedAt: now(), endsAt: null, createdAt: now(), updatedAt: now() });
subscriptions.set(ORG_IDS.PLUS, { orgId: ORG_IDS.PLUS, plan: "plus", duration: "yearly", status: "active", startedAt: now(), endsAt: null, createdAt: now(), updatedAt: now() });
subscriptions.set(ORG_IDS.PRO, { orgId: ORG_IDS.PRO, plan: "pro", duration: "yearly", status: "active", startedAt: now(), endsAt: null, createdAt: now(), updatedAt: now() });

// ——— API ———

export function getOrgById(orgId) {
  return orgs.get(orgId) ?? null;
}

export function findUserByUsername(username) {
  const u = String(username ?? "").trim().toLowerCase();
  return users.get(u) ?? null;
}

export function findUserById(userId) {
  for (const u of users.values()) {
    if (u.id === userId) return u;
  }
  return null;
}


export async function verifyPassword(user, password) {
  const plain = String(password ?? "");
  if (user.passwordHash) {
    return bcrypt.compare(plain, user.passwordHash);
  }
  return false;
}

export function getSubscription(orgId) {
  return subscriptions.get(orgId) ?? null;
}

export function getOadminUsernameForOrg(orgId) {
  for (const u of users.values()) {
    if (u.orgId === orgId && u.role === "oadmin") return u.username;
  }
  return null;
}

export function listOusersByOrgId(orgId) {
  const list = [];
  for (const u of users.values()) {
    if (u.orgId === orgId && u.role === "ouser") {
      list.push({ id: u.id, username: u.username, displayName: u.displayName ?? u.username, role: u.role });
    }
  }
  return list.sort((a, b) => String(a.username).localeCompare(b.username));
}

export function setOuserPermissionsByKeys(accountId, allowedModuleKeys) {
  const keys = Array.isArray(allowedModuleKeys) ? allowedModuleKeys.filter(Boolean) : [];
  const perms = Object.fromEntries(keys.map((k) => [k, "read_write"]));
  ouserPermissions.set(accountId, perms);
  return { ok: true };
}

export function updateUsername(userId, newUsername) {
  const user = findUserById(userId);
  if (!user) return { ok: false, error: "المستخدم غير موجود." };
  const newKey = String(newUsername ?? "").trim().toLowerCase();
  if (!newKey) return { ok: false, error: "اسم المستخدم الجديد مطلوب." };
  if (newKey === String(user.username).toLowerCase()) return { ok: true };
  if (users.has(newKey)) return { ok: false, error: "اسم المستخدم هذا مستخدم بالفعل." };
  const oldKey = String(user.username).toLowerCase();
  users.delete(oldKey);
  user.username = String(newUsername).trim();
  users.set(newKey, user);
  return { ok: true };
}

/** Verify secret code (same as password reset) then update username. Used for "change username" in settings. */
export async function validateSecretCodeAndUpdateUsername(userId, secretCode, newUsername) {
  const user = findUserById(userId);
  if (!user) return { ok: false, error: "المستخدم غير موجود." };
  if (!user.resetCodeHash) return { ok: false, error: "الرمز السري غير مفعّل لهذا الحساب." };
  const valid = await bcrypt.compare(String(secretCode ?? ""), user.resetCodeHash);
  if (!valid) return { ok: false, error: "الرمز السري غير صحيح." };
  return updateUsername(userId, newUsername);
}

export async function validateResetCodeAndSetPassword(username, resetCode, newPassword) {
  const user = findUserByUsername(username);
  if (!user) return { ok: false, error: "اسم المستخدم غير موجود." };
  if (!user.resetCodeHash) return { ok: false, error: "رمز إعادة التعيين غير مفعّل لهذا الحساب." };
  const codeValid = await bcrypt.compare(String(resetCode ?? ""), user.resetCodeHash);
  if (!codeValid) return { ok: false, error: "رمز إعادة التعيين غير صحيح." };
  const plain = String(newPassword ?? "").trim();
  if (plain.length < 4) return { ok: false, error: "كلمة المرور الجديدة يجب أن تكون 4 أحرف على الأقل." };
  user.passwordHash = await bcrypt.hash(plain, SALT_ROUNDS);
  return { ok: true };
}

export async function createUser(username, plainPassword, { orgId, role = "ouser", displayName } = {}) {
  const u = String(username ?? "").trim();
  if (!u) return { ok: false, error: "اسم المستخدم مطلوب." };
  const key = u.toLowerCase();
  if (users.has(key)) return { ok: false, error: "اسم المستخدم مستخدم بالفعل." };
  const p = String(plainPassword ?? "").trim();
  if (p.length < 4) return { ok: false, error: "كلمة المرور يجب أن تكون 4 أحرف على الأقل." };
  if (!orgId) return { ok: false, error: "المؤسسة مطلوبة." };
  const passwordHash = await bcrypt.hash(p, SALT_ROUNDS);
  const resetCode = generateSixDigitCode();
  const resetCodeHash = await bcrypt.hash(resetCode, SALT_ROUNDS);
  const id = `user-${key}-${Date.now()}`;
  const user = {
    id,
    orgId,
    username: u,
    passwordHash,
    resetCodeHash,
    role: role || "ouser",
    displayName: displayName || u,
  };
  users.set(key, user);
  return {
    ok: true,
    user: { id: user.id, username: user.username, orgId: user.orgId, role: user.role, displayName: user.displayName },
    resetCode,
  };
}

export function getAllUsers() {
  return Array.from(users.values()).map((u) => ({
    id: u.id,
    username: u.username,
    role: u.role,
    displayName: u.displayName,
    orgId: u.orgId,
  }));
}

export async function regenerateAllCredentials() {
  const credentials = [];
  for (const user of users.values()) {
    const secretCode = generateSixDigitCode();
    const password = generateRandomPassword();
    user.passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    user.resetCodeHash = await bcrypt.hash(secretCode, SALT_ROUNDS);
    credentials.push({ username: user.username, password, secretCode });
  }
  return { ok: true, credentials };
}

export const PERMISSION_LEVELS = Object.freeze(["no_access", "read", "read_write"]);

export function getOuserModulePermissions(userId) {
  const raw = ouserPermissions.get(userId);
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return { ...raw };
  if (Array.isArray(raw)) {
    const obj = {};
    raw.forEach((k) => { obj[k] = "read_write"; });
    return obj;
  }
  return {};
}

export function getOuserModulePermissionsForPlan(userId, enabledModuleKeys) {
  const perms = getOuserModulePermissions(userId);
  const allowed = new Set(enabledModuleKeys);
  const result = {};
  for (const key of allowed) {
    const val = perms[key];
    if (val === "read" || val === "read_write") result[key] = val;
  }
  return result;
}

export function getAllowedModules(userId) {
  const perms = getOuserModulePermissions(userId);
  return Object.entries(perms)
    .filter(([, v]) => v === "read" || v === "read_write")
    .map(([k]) => k);
}

/** Set ouser permissions. permissions = { moduleKey: "read"|"read_write" }. Replaces existing. */
export function setOuserPermissions(userId, permissions) {
  const valid = {};
  for (const [key, val] of Object.entries(permissions || {})) {
    if (val === "read" || val === "read_write") valid[key] = val;
  }
  ouserPermissions.set(userId, { ...valid });
  return { ok: true };
}

export function hasAddonOuser(orgId) {
  return addons.get(orgId)?.has("ouser") ?? false;
}

export function getPlanForOrg(orgId) {
  const sub = getSubscription(orgId);
  if (sub && sub.status === "active") return sub.plan;
  return "basic";
}

export function setSubscriptionPlan(orgId, plan, duration = "monthly") {
  const sub = subscriptions.get(orgId);
  if (!sub) return null;
  sub.plan = plan;
  sub.duration = duration;
  sub.updatedAt = now();
  return sub;
}
