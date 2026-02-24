/**
 * Finance API: Supabase when env set, else in-memory store.
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { finance as storeFinance } from "./store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

const useDb = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

let financeMod;
if (useDb) {
  const db = await import("./finance-db.js");
  financeMod = {
    getKv: (orgId) => db.getKv(orgId),
    setKv: (orgId, key, value) => db.setKv(orgId, key, value),
    setAll: (orgId, kv) => db.setAll(orgId, kv),
  };
} else {
  financeMod = {
    getKv: () => storeFinance.getKv(),
    setKv: (_orgId, key, value) => storeFinance.setKv(key, value),
    setAll: (_orgId, kv) => storeFinance.setAll(kv),
  };
}

export const finance = financeMod;
