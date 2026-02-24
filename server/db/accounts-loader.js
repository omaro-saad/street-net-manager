/**
 * Single accounts API: uses Supabase DB when SUPABASE_URL is set, else in-memory.
 * All methods are async so auth/middleware can await.
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

const useDb = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

let accountsMod;
if (useDb) {
  accountsMod = await import("./accounts-db.js");
} else {
  const mem = await import("./accounts.js");
  accountsMod = {
    findUserByUsername: (u) => Promise.resolve(mem.findUserByUsername(u)),
    findUserById: (id) => Promise.resolve(mem.findUserById(id)),
    verifyPassword: mem.verifyPassword,
    getOrgById: (id) => Promise.resolve(mem.getOrgById(id)),
    getSubscription: (id) => Promise.resolve(mem.getSubscription(id)),
    getOadminUsernameForOrg: (id) => Promise.resolve(mem.getOadminUsernameForOrg?.(id) ?? null),
    listOusersByOrgId: (id) => Promise.resolve(mem.listOusersByOrgId?.(id) ?? []),
    setOuserPermissions: (id, perms) => Promise.resolve(mem.setOuserPermissions?.(id, perms) ?? { ok: true }),
    getOuserModulePermissionsForPlan: (userId, keys) =>
      Promise.resolve(mem.getOuserModulePermissionsForPlan(userId, keys)),
    updateUsername: (id, u) => Promise.resolve(mem.updateUsername(id, u)),
    validateSecretCodeAndUpdateUsername: mem.validateSecretCodeAndUpdateUsername,
    validateResetCodeAndSetPassword: mem.validateResetCodeAndSetPassword,
    createUser: mem.createUser,
  };
}

export const accounts = accountsMod;
