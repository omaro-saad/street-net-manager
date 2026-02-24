/**
 * Subscribers API: Supabase when env set, else in-memory store.
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { subscribers as storeSubscribers } from "./store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

const useDb = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

let subscribersMod;
if (useDb) {
  const db = await import("./subscribers-db.js");
  subscribersMod = {
    list: (orgId) => db.list(orgId),
    add: (orgId, row) => db.add(orgId, row),
    update: (orgId, id, patch) => db.update(orgId, id, patch),
    remove: (orgId, id) => db.remove(orgId, id),
    count: (orgId) => db.count(orgId),
  };
} else {
  subscribersMod = {
    list: () => storeSubscribers.list(),
    add: (_orgId, row) => storeSubscribers.add(row),
    update: (_orgId, id, patch) => storeSubscribers.update(id, patch),
    remove: (_orgId, id) => storeSubscribers.remove(id),
    count: async () => {
      const list = await storeSubscribers.list();
      return Array.isArray(list) ? list.length : 0;
    },
  };
}

export const subscribers = subscribersMod;
