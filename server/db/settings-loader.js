/**
 * Settings API: Supabase when env set, else in-memory store.
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { settings as storeSettings } from "./store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

const useDb = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

let settingsMod;
if (useDb) {
  const db = await import("./settings-db.js");
  settingsMod = {
    get: (orgId) => db.get(orgId),
    set: (orgId, payload) => db.set(orgId, payload),
  };
} else {
  settingsMod = {
    get: () => storeSettings.get(),
    set: (_orgId, payload) => storeSettings.set(payload),
  };
}

export const settings = settingsMod;
