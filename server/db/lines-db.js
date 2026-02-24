/**
 * Lines table in Supabase. Scoped by org_id.
 * Used when SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.
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

function rowToLine(r) {
  if (!r) return null;
  return {
    id: r.id,
    key: `line:${r.id}`,
    name: r.name ?? "",
    address: r.address ?? "",
    active: r.active !== false,
    createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
    updatedAt: r.updated_at ? new Date(r.updated_at).getTime() : Date.now(),
  };
}

export async function list(orgId) {
  const { data, error } = await getSupabase()
    .from("lines")
    .select("id, name, address, active, created_at, updated_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data || []).map(rowToLine);
}

export async function add(orgId, row) {
  const name = String(row?.name ?? "").trim();
  const address = String(row?.address ?? "").trim();
  const active = row?.active !== false;
  const { data, error } = await getSupabase()
    .from("lines")
    .insert({
      org_id: orgId,
      name,
      address,
      active,
    })
    .select("id, name, address, active, created_at, updated_at")
    .single();
  if (error) throw new Error(error.message);
  return rowToLine(data);
}

export async function update(orgId, id, patch) {
  const updates = {};
  if (patch?.name !== undefined) updates.name = String(patch.name).trim();
  if (patch?.address !== undefined) updates.address = String(patch.address).trim();
  if (patch?.active !== undefined) updates.active = patch.active !== false;
  updates.updated_at = new Date().toISOString();
  const { data, error } = await getSupabase()
    .from("lines")
    .update(updates)
    .eq("id", id)
    .eq("org_id", orgId)
    .select("id, name, address, active, created_at, updated_at")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToLine(data) : null;
}

export async function remove(orgId, id) {
  const { error } = await getSupabase().from("lines").delete().eq("id", id).eq("org_id", orgId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function count(orgId) {
  const { count, error } = await getSupabase()
    .from("lines")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId);
  if (error) return 0;
  return count ?? 0;
}

export async function deleteAllByOrgId(orgId) {
  const { error } = await getSupabase().from("lines").delete().eq("org_id", orgId);
  if (error) throw new Error(error.message);
}
