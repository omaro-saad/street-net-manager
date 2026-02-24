/**
 * Org settings table in Supabase. One row per org. data JSONB = { theme, companyName, companyAbout }.
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

const defaultAdmin = { theme: "light", companyName: "", companyAbout: "" };

function normalizeAdmin(raw) {
  const o = raw && typeof raw === "object" ? raw : {};
  return {
    theme: o.theme === "dark" ? "dark" : "light",
    companyName: typeof o.companyName === "string" ? o.companyName : "",
    companyAbout: typeof o.companyAbout === "string" ? o.companyAbout : "",
  };
}

export async function get(orgId) {
  const { data, error } = await getSupabase()
    .from("org_settings")
    .select("data, updated_at")
    .eq("org_id", orgId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || !data.data) return { admin: { ...defaultAdmin } };
  const admin = normalizeAdmin(data.data.admin ?? data.data);
  return { admin };
}

export async function set(orgId, payload) {
  const admin = normalizeAdmin(payload?.admin ?? payload ?? {});
  const { data: row, error } = await getSupabase()
    .from("org_settings")
    .upsert(
      { org_id: orgId, data: { admin }, updated_at: new Date().toISOString() },
      { onConflict: "org_id" }
    )
    .select("data, updated_at")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return row ? { admin: normalizeAdmin(row.data?.admin ?? row.data) } : { admin };
}
