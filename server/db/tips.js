/**
 * User tips (onboarding) — in-memory. Tracks which pages' tips the user has seen (once per user).
 */
const tipsSeen = new Map(); // accountId -> Set<pageKey>

/**
 * @param {string} accountId
 * @returns {Promise<Record<string, boolean>>}
 */
export async function getTipsSeen(accountId) {
  const set = tipsSeen.get(accountId);
  if (!set) return {};
  const out = {};
  for (const k of set) out[k] = true;
  return out;
}

/**
 * @param {string} accountId
 * @param {string} pageKey
 */
export async function markTipsSeen(accountId, pageKey) {
  const key = String(pageKey ?? "").trim();
  if (!key) throw new Error("page_key مطلوب.");
  let set = tipsSeen.get(accountId);
  if (!set) {
    set = new Set();
    tipsSeen.set(accountId, set);
  }
  set.add(key);
}
