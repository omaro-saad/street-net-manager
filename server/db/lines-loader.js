/**
 * Lines API: Supabase when env set, else in-memory store.
 * All methods accept orgId first; store is global (no org) when not using DB.
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { lines as storeLines } from "./store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

const useDb = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

let linesMod;
if (useDb) {
  const db = await import("./lines-db.js");
  linesMod = {
    list: (orgId) => db.list(orgId),
    add: (orgId, row) => db.add(orgId, row),
    update: (orgId, id, patch) => db.update(orgId, id, patch),
    remove: (orgId, id) => db.remove(orgId, id),
    count: (orgId) => db.count(orgId),
  };
} else {
  linesMod = {
    list: () => storeLines.list(),
    add: (_orgId, row) => storeLines.add(row),
    update: (_orgId, id, patch) => storeLines.update(id, patch),
    remove: (_orgId, id) => storeLines.remove(id),
    count: async () => {
      const list = await storeLines.list();
      return Array.isArray(list) ? list.length : 0;
    },
  };
}

export const lines = linesMod;
