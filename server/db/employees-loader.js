/**
 * Employees API: Supabase when env set, else in-memory store.
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { employees as storeEmployees } from "./store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

const useDb = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

let employeesMod;
if (useDb) {
  const db = await import("./employees-db.js");
  employeesMod = {
    list: (orgId) => db.list(orgId),
    add: (orgId, row) => db.add(orgId, row),
    update: (orgId, id, patch) => db.update(orgId, id, patch),
    remove: (orgId, id) => db.remove(orgId, id),
    count: (orgId) => db.count(orgId),
  };
} else {
  employeesMod = {
    list: () => storeEmployees.list(),
    add: (_orgId, row) => storeEmployees.add(row),
    update: (_orgId, id, patch) => storeEmployees.update(id, patch),
    remove: (_orgId, id) => storeEmployees.remove(id),
    count: async () => {
      const list = await storeEmployees.list();
      return Array.isArray(list) ? list.length : 0;
    },
  };
}

export const employees = employeesMod;
