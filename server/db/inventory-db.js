/**
 * Inventory table in Supabase. One row per org. data JSONB = { warehouses, sections, items }.
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

const defaultInventory = { warehouses: [], sections: [], items: [] };

export async function get(orgId) {
  const { data, error } = await getSupabase()
    .from("inventory")
    .select("data, updated_at")
    .eq("org_id", orgId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || !data.data) return { ...defaultInventory };
  const d = data.data;
  return {
    warehouses: Array.isArray(d.warehouses) ? d.warehouses : [],
    sections: Array.isArray(d.sections) ? d.sections : [],
    items: Array.isArray(d.items) ? d.items : [],
  };
}

export async function set(orgId, payload) {
  const body = payload && typeof payload === "object" ? payload : {};
  const data = {
    warehouses: Array.isArray(body.warehouses) ? body.warehouses : [],
    sections: Array.isArray(body.sections) ? body.sections : [],
    items: Array.isArray(body.items) ? body.items : [],
  };
  const { data: row, error } = await getSupabase()
    .from("inventory")
    .upsert(
      { org_id: orgId, data, updated_at: new Date().toISOString() },
      { onConflict: "org_id" }
    )
    .select("data, updated_at")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return row ? { ...defaultInventory, ...row.data } : { ...defaultInventory, ...data };
}
