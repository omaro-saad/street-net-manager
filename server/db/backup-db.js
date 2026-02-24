/**
 * Org backups table in Supabase. One row per org. data JSONB = full snapshot (subscribers, distributors, lines, packages, employees, finance, inventory, maps, settings).
 * Linked by org_id (organization). Admin uses backup/restore in Settings; org is determined by logged-in user (JWT).
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

export async function get(orgId) {
  const { data, error } = await getSupabase()
    .from("org_backups")
    .select("data, updated_at")
    .eq("org_id", orgId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || !data.data || typeof data.data !== "object") return null;
  return JSON.parse(JSON.stringify(data.data));
}

export async function set(orgId, snapshot) {
  const payload = snapshot && typeof snapshot === "object" ? JSON.parse(JSON.stringify(snapshot)) : {};
  const { error } = await getSupabase()
    .from("org_backups")
    .upsert(
      { org_id: orgId, data: payload, updated_at: new Date().toISOString() },
      { onConflict: "org_id" }
    );
  if (error) throw new Error(error.message);
  return payload;
}
