/**
 * Subscribers table in Supabase. Scoped by org_id. data JSONB = full subscriber row.
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

function rowToSubscriber(r) {
  if (!r) return null;
  const data = r.data && typeof r.data === "object" ? r.data : {};
  const createdAt = r.created_at ? new Date(r.created_at).getTime() : Date.now();
  const updatedAt = r.updated_at ? new Date(r.updated_at).getTime() : Date.now();
  return { id: r.id, ...data, createdAt, updatedAt };
}

export async function list(orgId) {
  const { data, error } = await getSupabase()
    .from("subscribers")
    .select("id, data, created_at, updated_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data || []).map(rowToSubscriber);
}

export async function add(orgId, row) {
  const payload = row && typeof row === "object" ? { ...row } : {};
  delete payload.id;
  const { data, error } = await getSupabase()
    .from("subscribers")
    .insert({ org_id: orgId, data: payload })
    .select("id, data, created_at, updated_at")
    .single();
  if (error) throw new Error(error.message);
  return rowToSubscriber(data);
}

export async function update(orgId, id, patch) {
  const { data: existing, error: fetchErr } = await getSupabase()
    .from("subscribers")
    .select("id, data")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();
  if (fetchErr || !existing) return null;
  const merged = { ...(existing.data || {}), ...(patch && typeof patch === "object" ? patch : {}) };
  const { data, error } = await getSupabase()
    .from("subscribers")
    .update({ data: merged, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("org_id", orgId)
    .select("id, data, created_at, updated_at")
    .maybeSingle();
  if (error) return null;
  return data ? rowToSubscriber(data) : null;
}

export async function remove(orgId, id) {
  const { error } = await getSupabase().from("subscribers").delete().eq("id", id).eq("org_id", orgId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function count(orgId) {
  const { count, error } = await getSupabase()
    .from("subscribers")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId);
  if (error) return 0;
  return count ?? 0;
}

export async function deleteAllByOrgId(orgId) {
  const { error } = await getSupabase().from("subscribers").delete().eq("org_id", orgId);
  if (error) throw new Error(error.message);
}
