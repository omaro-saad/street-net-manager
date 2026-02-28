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
 * Get which page keys the user has already seen tips for (by public_id).
 * @param {number} publicId - accounts.public_id (9-digit)
 * @returns {Promise<Record<string, boolean>>} e.g. { home: true, onboarding_done: true }
 */
export async function getTipsSeen(publicId) {
  if (publicId == null) return {};
  const { data, error } = await getSupabase()
    .from("user_tips")
    .select("page_key")
    .eq("public_id", publicId);
  if (error) throw new Error(error.message);
  const out = {};
  for (const row of data || []) {
    if (row?.page_key) out[row.page_key] = true;
  }
  return out;
}

/**
 * Mark tips as seen for a page. Idempotent. Uses public_id; accountId required for insert (account_id NOT NULL).
 * @param {number} publicId - accounts.public_id
 * @param {string} pageKey - e.g. 'home'
 * @param {string} [accountId] - account id (for insert when table has account_id NOT NULL)
 */
export async function markTipsSeen(publicId, pageKey, accountId) {
  if (publicId == null) return;
  const key = String(pageKey ?? "").trim();
  if (!key) throw new Error("page_key مطلوب.");
  const row = { public_id: publicId, page_key: key, seen_at: new Date().toISOString() };
  if (accountId) row.account_id = accountId;
  const { error } = await getSupabase()
    .from("user_tips")
    .upsert(row, { onConflict: "public_id,page_key" });
  if (error) throw new Error(error.message);
}
