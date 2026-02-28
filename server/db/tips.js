/**
 * User tips (onboarding) — in-memory. Keyed by public_id (9-digit).
 */
const tipsSeen = new Map(); // publicId -> Set<pageKey>

/**
 * @param {number} publicId - accounts.public_id
 * @returns {Promise<Record<string, boolean>>}
 */
export async function getTipsSeen(publicId) {
  if (publicId == null) return {};
  const set = tipsSeen.get(publicId);
  if (!set) return {};
  const out = {};
  for (const k of set) out[k] = true;
  return out;
}

/**
 * @param {number} publicId - accounts.public_id
 * @param {string} pageKey
 */
export async function markTipsSeen(publicId, pageKey) {
  if (publicId == null) return;
  const key = String(pageKey ?? "").trim();
  if (!key) throw new Error("page_key مطلوب.");
  let set = tipsSeen.get(publicId);
  if (!set) {
    set = new Set();
    tipsSeen.set(publicId, set);
  }
  set.add(key);
}
