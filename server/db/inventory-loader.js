/**
 * Inventory API: Supabase when env set, else in-memory store.
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { inventory as storeInventory } from "./store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

const useDb = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

let inventoryMod;
if (useDb) {
  const db = await import("./inventory-db.js");
  inventoryMod = {
    get: (orgId) => db.get(orgId),
    set: (orgId, payload) => db.set(orgId, payload),
  };
} else {
  inventoryMod = {
    get: () => storeInventory.get(),
    set: (_orgId, payload) => storeInventory.set(payload),
  };
}

export const inventory = inventoryMod;
