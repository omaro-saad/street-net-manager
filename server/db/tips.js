/**
 * User tips (onboarding) — in-memory. Keyed by public_id or, when null, by account id.
 * Persists to server/.data/tips-seen.json so "seen" survives server restart.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "..", ".data");
const FILE_PATH = path.join(DATA_DIR, "tips-seen.json");

const tipsSeen = new Map(); // key: publicId (number) or "a:"+accountId (string)

function tipsKey(publicId, accountId) {
  if (publicId != null) return publicId;
  if (accountId != null) return "a:" + String(accountId);
  return null;
}

/** Persisted: accountId -> array of page_key (stable across restarts). */
function loadPersisted() {
  try {
    if (fs.existsSync(FILE_PATH)) {
      const raw = fs.readFileSync(FILE_PATH, "utf8");
      const data = JSON.parse(raw);
      if (data && typeof data === "object") {
        for (const [accountId, keys] of Object.entries(data)) {
          if (Array.isArray(keys)) {
            const key = "a:" + String(accountId);
            let set = tipsSeen.get(key);
            if (!set) {
              set = new Set();
              tipsSeen.set(key, set);
            }
            keys.forEach((k) => set.add(String(k)));
          }
        }
      }
    }
  } catch {
    // ignore
  }
}

function savePersisted() {
  try {
    const byAccount = {};
    for (const [key, set] of tipsSeen) {
      if (key.startsWith("a:") && set && typeof set.forEach === "function") {
        const accountId = key.slice(2);
        byAccount[accountId] = [...set];
      }
    }
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(FILE_PATH, JSON.stringify(byAccount, null, 0), "utf8");
  } catch {
    // ignore
  }
}

loadPersisted();

/**
 * @param {number|null} publicId - accounts.public_id
 * @param {string} [accountId] - fallback when publicId is null; also used to merge persisted data
 * @returns {Promise<Record<string, boolean>>}
 */
export async function getTipsSeen(publicId, accountId) {
  const key = tipsKey(publicId, accountId);
  if (key == null) return {};
  const sets = [tipsSeen.get(key)];
  if (accountId) sets.push(tipsSeen.get("a:" + String(accountId)));
  const out = {};
  for (const set of sets) {
    if (set) for (const k of set) out[k] = true;
  }
  return out;
}

/**
 * @param {number|null} publicId - accounts.public_id
 * @param {string} pageKey
 * @param {string} [accountId] - fallback when publicId is null; when present we also persist by accountId
 */
export async function markTipsSeen(publicId, pageKey, accountId) {
  const key = tipsKey(publicId, accountId);
  if (key == null) return;
  const pk = String(pageKey ?? "").trim();
  if (!pk) throw new Error("page_key مطلوب.");
  for (const k of [key].concat(accountId ? ["a:" + String(accountId)] : [])) {
    let set = tipsSeen.get(k);
    if (!set) {
      set = new Set();
      tipsSeen.set(k, set);
    }
    set.add(pk);
  }
  if (accountId) savePersisted();
}
