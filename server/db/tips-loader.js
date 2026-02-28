/**
 * Tips API: uses Supabase when SUPABASE_URL is set, else in-memory.
 * Both getTipsSeen(publicId, accountId) and markTipsSeen(publicId, pageKey, accountId) support accountId fallback when publicId is null (in-memory only).
 */
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

const useDb = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

let tipsMod;
if (useDb) {
  tipsMod = await import("./tips-db.js");
} else {
  tipsMod = await import("./tips.js");
}

export async function getTipsSeen(publicId, accountId) {
  return tipsMod.getTipsSeen(publicId, accountId);
}
export async function markTipsSeen(publicId, pageKey, accountId) {
  return tipsMod.markTipsSeen(publicId, pageKey, accountId);
}
