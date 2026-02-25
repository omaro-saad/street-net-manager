/**
 * User tips (onboarding) — Supabase. Tracks which pages' tips the user has seen (once per user).
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

/**
 * Get which page keys the user has already seen tips for.
 * @param {string} accountId - account (user) id
 * @returns {Promise<Record<string, boolean>>} e.g. { home: true }
 */
export async function getTipsSeen(accountId) {
  const { data, error } = await getSupabase()
    .from("user_tips")
    .select("page_key")
    .eq("account_id", accountId);
  if (error) throw new Error(error.message);
  const out = {};
  for (const row of data || []) {
    if (row?.page_key) out[row.page_key] = true;
  }
  return out;
}

/**
 * Mark tips as seen for a page. Idempotent.
 * @param {string} accountId
 * @param {string} pageKey - e.g. 'home'
 */
export async function markTipsSeen(accountId, pageKey) {
  const key = String(pageKey ?? "").trim();
  if (!key) throw new Error("page_key مطلوب.");
  const { error } = await getSupabase()
    .from("user_tips")
    .upsert(
      { account_id: accountId, page_key: key, seen_at: new Date().toISOString() },
      { onConflict: "account_id,page_key" }
    );
  if (error) throw new Error(error.message);
}
