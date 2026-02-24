/**
 * Distributors API: Supabase when env set, else in-memory store.
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { distributors as storeDistributors } from "./store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

const useDb = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

let distributorsMod;
if (useDb) {
  const db = await import("./distributors-db.js");
  distributorsMod = {
    list: (orgId) => db.list(orgId),
    add: (orgId, row) => db.add(orgId, row),
    update: (orgId, id, patch) => db.update(orgId, id, patch),
    remove: (orgId, id) => db.remove(orgId, id),
    count: (orgId) => db.count(orgId),
  };
} else {
  distributorsMod = {
    list: () => storeDistributors.list(),
    add: (_orgId, row) => storeDistributors.add(row),
    update: (_orgId, id, patch) => storeDistributors.update(id, patch),
    remove: (_orgId, id) => storeDistributors.remove(id),
    count: async () => {
      const list = await storeDistributors.list();
      return Array.isArray(list) ? list.length : 0;
    },
  };
}

export const distributors = distributorsMod;
