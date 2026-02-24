/**
 * Employees table in Supabase. Scoped by org_id. data JSONB = full employee row.
 */
import { createClient } from "@supabase/supabase-js";

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

function rowToEmployee(r) {
  if (!r) return null;
  const data = r.data && typeof r.data === "object" ? r.data : {};
  return { id: String(r.id), ...data };
}

export async function list(orgId) {
  const { data, error } = await getSupabase()
    .from("employees")
    .select("id, data, created_at, updated_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data || []).map(rowToEmployee);
}

export async function add(orgId, row) {
  const payload = row && typeof row === "object" ? { ...row } : {};
  delete payload.id;
  const { data, error } = await getSupabase()
    .from("employees")
    .insert({ org_id: orgId, data: payload })
    .select("id, data, created_at, updated_at")
    .single();
  if (error) throw new Error(error.message);
  return rowToEmployee(data);
}

export async function update(orgId, id, patch) {
  const { data: existing, error: fetchErr } = await getSupabase()
    .from("employees")
    .select("id, data")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();
  if (fetchErr || !existing) return null;
  const merged = { ...(existing.data || {}), ...(patch && typeof patch === "object" ? patch : {}) };
  const { data, error } = await getSupabase()
    .from("employees")
    .update({ data: merged, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("org_id", orgId)
    .select("id, data, created_at, updated_at")
    .maybeSingle();
  if (error) return null;
  return data ? rowToEmployee(data) : null;
}

export async function remove(orgId, id) {
  const { error } = await getSupabase().from("employees").delete().eq("id", id).eq("org_id", orgId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function count(orgId) {
  const { count, error } = await getSupabase()
    .from("employees")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId);
  if (error) return 0;
  return count ?? 0;
}

export async function deleteAllByOrgId(orgId) {
  const { error } = await getSupabase().from("employees").delete().eq("org_id", orgId);
  if (error) throw new Error(error.message);
}
