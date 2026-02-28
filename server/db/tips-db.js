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
 * Get which page keys the user has already seen tips for (by public_id, or by account_id when public_id is null).
 * @param {number|null} publicId - accounts.public_id (9-digit)
 * @param {string} [accountId] - used when publicId is null to query by account_id
 * @returns {Promise<Record<string, boolean>>} e.g. { home: true }
 */
export async function getTipsSeen(publicId, accountId) {
  const supabase = getSupabase();
  if (publicId != null) {
    const { data, error } = await supabase
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
  if (accountId == null) return {};
  const { data, error } = await supabase
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
 * Mark tips as seen for a page. Idempotent. Uses public_id; when null, resolves from accounts by accountId.
 * @param {number|null} publicId - accounts.public_id
 * @param {string} pageKey - e.g. 'home'
 * @param {string} [accountId] - account id (for insert and for resolving public_id when null)
 */
export async function markTipsSeen(publicId, pageKey, accountId) {
  let resolvedPublicId = publicId;
  if (resolvedPublicId == null && accountId) {
    const { getPublicIdByAccountId } = await import("./accounts-db.js");
    resolvedPublicId = await getPublicIdByAccountId(accountId);
  }
  if (resolvedPublicId == null) return;
  const key = String(pageKey ?? "").trim();
  if (!key) throw new Error("page_key مطلوب.");
  const row = { public_id: resolvedPublicId, page_key: key, seen_at: new Date().toISOString() };
  if (accountId) row.account_id = accountId;
  const { error } = await getSupabase()
    .from("user_tips")
    .upsert(row, { onConflict: "public_id,page_key" });
  if (error) throw new Error(error.message);
}
