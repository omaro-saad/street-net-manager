/**
 * Packages API: Supabase when env set, else in-memory store.
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { packages as storePackages } from "./store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

const useDb = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

let packagesMod;
if (useDb) {
  const db = await import("./packages-db.js");
  packagesMod = {
    list: (orgId) => db.list(orgId),
    add: (orgId, row) => db.add(orgId, row),
    update: (orgId, id, patch) => db.update(orgId, id, patch),
    remove: (orgId, id) => db.remove(orgId, id),
    countByTarget: (orgId) => db.countByTarget(orgId),
  };
} else {
  packagesMod = {
    list: () => storePackages.list(),
    add: (_orgId, row) => storePackages.add(row),
    update: (_orgId, id, patch) => storePackages.update(id, patch),
    remove: (_orgId, id) => storePackages.remove(id),
    countByTarget: async () => {
      const list = await storePackages.list();
      const arr = Array.isArray(list) ? list : [];
      return {
        subscriber: arr.filter((r) => r?.target === "subscriber").length,
        distributor: arr.filter((r) => r?.target === "distributor").length,
      };
    },
  };
}

export const packages = packagesMod;
