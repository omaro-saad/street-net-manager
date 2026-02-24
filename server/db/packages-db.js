/**
 * Packages table in Supabase. Scoped by org_id. data JSONB = full package row.
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

function rowToPackage(r) {
  if (!r) return null;
  const data = r.data && typeof r.data === "object" ? r.data : {};
  return { id: r.id, ...data, target: r.target || data.target || "subscriber" };
}

export async function list(orgId) {
  const { data, error } = await getSupabase()
    .from("packages")
    .select("id, target, data")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data || []).map(rowToPackage);
}

export async function add(orgId, row) {
  const target = row?.target === "distributor" ? "distributor" : "subscriber";
  const payload = row && typeof row === "object" ? { ...row } : {};
  delete payload.id;
  const { data, error } = await getSupabase()
    .from("packages")
    .insert({ org_id: orgId, target, data: payload })
    .select("id, target, data")
    .single();
  if (error) throw new Error(error.message);
  return rowToPackage(data);
}

export async function update(orgId, id, patch) {
  const { data: existing, error: fetchErr } = await getSupabase()
    .from("packages")
    .select("id, data")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();
  if (fetchErr || !existing) return null;
  const merged = { ...(existing.data || {}), ...(patch && typeof patch === "object" ? patch : {}) };
  const { data, error } = await getSupabase()
    .from("packages")
    .update({ data: merged, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("org_id", orgId)
    .select("id, target, data")
    .maybeSingle();
  if (error) return null;
  return data ? rowToPackage(data) : null;
}

export async function remove(orgId, id) {
  const { error } = await getSupabase().from("packages").delete().eq("id", id).eq("org_id", orgId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function countByTarget(orgId) {
  const { data, error } = await getSupabase().from("packages").select("target").eq("org_id", orgId);
  if (error) return { subscriber: 0, distributor: 0 };
  const list = data || [];
  return {
    subscriber: list.filter((r) => r.target === "subscriber").length,
    distributor: list.filter((r) => r.target === "distributor").length,
  };
}

export async function deleteAllByOrgId(orgId) {
  const { error } = await getSupabase().from("packages").delete().eq("org_id", orgId);
  if (error) throw new Error(error.message);
}
