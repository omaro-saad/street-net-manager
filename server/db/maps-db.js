/**
 * Maps table in Supabase. One row per (org_id, line_id). data JSONB = full map payload (nodes, edges, viewport).
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

export async function get(orgId, lineId) {
  const lid = String(lineId ?? "").trim();
  if (!lid) return null;
  const { data, error } = await getSupabase()
    .from("maps")
    .select("id, data, created_at, updated_at")
    .eq("org_id", orgId)
    .eq("line_id", lid)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? (data.data && typeof data.data === "object" ? data.data : null) : null;
}

export async function set(orgId, lineId, payload) {
  const lid = String(lineId ?? "").trim();
  if (!lid) throw new Error("lineId required");
  const body = payload && typeof payload === "object" ? payload : {};
  const { data, error } = await getSupabase()
    .from("maps")
    .upsert(
      {
        org_id: orgId,
        line_id: lid,
        data: body,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "org_id,line_id" }
    )
    .select("id, data, updated_at")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? (data.data && typeof data.data === "object" ? data.data : null) : null;
}

export async function deleteAllByOrgId(orgId) {
  const { error } = await getSupabase().from("maps").delete().eq("org_id", orgId);
  if (error) throw new Error(error.message);
}
