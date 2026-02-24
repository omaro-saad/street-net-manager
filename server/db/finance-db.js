/**
 * Finance table in Supabase. One row per org. data JSONB = _kv (manualInvoices, autoInvoices, etc.).
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

export async function getKv(orgId) {
  const { data, error } = await getSupabase()
    .from("finance")
    .select("data, updated_at")
    .eq("org_id", orgId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || !data.data) return {};
  return data.data && typeof data.data === "object" ? { ...data.data } : {};
}

export async function setKv(orgId, key, value) {
  const current = await getKv(orgId);
  const next = { ...current, [key]: value };
  const { data, error } = await getSupabase()
    .from("finance")
    .upsert(
      { org_id: orgId, data: next, updated_at: new Date().toISOString() },
      { onConflict: "org_id" }
    )
    .select("data, updated_at")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return next;
}

export async function setAll(orgId, kv) {
  const next = kv && typeof kv === "object" ? { ...kv } : {};
  const { data, error } = await getSupabase()
    .from("finance")
    .upsert(
      { org_id: orgId, data: next, updated_at: new Date().toISOString() },
      { onConflict: "org_id" }
    )
    .select("data, updated_at")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? { ...data.data } : next;
}
