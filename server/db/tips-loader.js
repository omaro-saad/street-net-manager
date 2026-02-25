/**
 * Tips API: uses Supabase when SUPABASE_URL is set, else in-memory.
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

export const getTipsSeen = tipsMod.getTipsSeen;
export const markTipsSeen = tipsMod.markTipsSeen;
