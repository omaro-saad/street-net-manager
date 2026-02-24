/**
 * Maps API: Supabase when env set, else in-memory store.
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { maps as storeMaps } from "./store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

const useDb = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

let mapsMod;
if (useDb) {
  const db = await import("./maps-db.js");
  mapsMod = {
    get: (orgId, lineId) => db.get(orgId, lineId),
    set: (orgId, lineId, payload) => db.set(orgId, lineId, payload),
  };
} else {
  mapsMod = {
    get: (_orgId, lineId) => storeMaps.get(lineId),
    set: (_orgId, lineId, payload) => storeMaps.set(lineId, payload),
  };
}

export const maps = mapsMod;
