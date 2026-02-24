/**
 * Backup API: Supabase when env set (one row per org in org_backups), else in-memory store.
 * Linked by organization (org_id from JWT). Admin only.
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { getBackup, setBackup, setFullState, getFullState } from "./store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

const useDb = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

function safeArray(x) {
  return Array.isArray(x) ? x : [];
}
function safeObj(x) {
  return x && typeof x === "object" && !Array.isArray(x) ? x : {};
}

let backupMod;

if (useDb) {
  const db = await import("./backup-db.js");
  const { subscribers } = await import("./subscribers-loader.js");
  const { distributors } = await import("./distributors-loader.js");
  const { lines } = await import("./lines-loader.js");
  const { packages } = await import("./packages-loader.js");
  const { employees } = await import("./employees-loader.js");
  const { finance } = await import("./finance-loader.js");
  const { inventory } = await import("./inventory-loader.js");
  const { maps } = await import("./maps-loader.js");
  const { settings } = await import("./settings-loader.js");

  async function buildSnapshot(orgId) {
    const [subList, distList, lineList, pkgList, empList, finKv, inv, sett] = await Promise.all([
      subscribers.list(orgId),
      distributors.list(orgId),
      lines.list(orgId),
      packages.list(orgId),
      employees.list(orgId),
      finance.getKv(orgId),
      inventory.get(orgId),
      settings.get(orgId),
    ]);
    return {
      subscribers: subList || [],
      distributors: distList || [],
      lines: { items: lineList || [] },
      packages: { items: pkgList || [] },
      employees: empList || [],
      finance: { _kv: finKv || {} },
      inventory: inv || { warehouses: [], sections: [], items: [] },
      maps: {}, // maps are per-line; could be loaded if needed
      settings: sett || { admin: {} },
      updatedAt: Date.now(),
    };
  }

  async function applyRestore(orgId, snapshot) {
    const s = safeObj(snapshot);
    const subList = safeArray(s.subscribers);
    const distList = safeArray(s.distributors);
    const lineItems = safeArray(s.lines?.items ?? s.lines);
    const pkgItems = safeArray(s.packages?.items ?? s.packages);
    const empList = safeArray(s.employees);
    const finKv = safeObj(s.finance?._kv ?? s.finance);
    const inv = safeObj(s.inventory);
    const mapsObj = safeObj(s.maps);
    const sett = safeObj(s.settings);

    const existingSubs = await subscribers.list(orgId);
    for (const row of existingSubs) {
      if (row?.id) await subscribers.remove(orgId, row.id);
    }
    for (const row of subList) {
      if (row && typeof row === "object") await subscribers.add(orgId, { ...row, id: undefined });
    }

    const existingDist = await distributors.list(orgId);
    for (const row of existingDist) {
      if (row?.id) await distributors.remove(orgId, row.id);
    }
    for (const row of distList) {
      if (row && typeof row === "object") await distributors.add(orgId, { ...row, id: undefined });
    }

    const existingLines = await lines.list(orgId);
    for (const row of existingLines) {
      if (row?.id) await lines.remove(orgId, row.id);
    }
    for (const row of lineItems) {
      if (row && typeof row === "object") await lines.add(orgId, { ...row, id: undefined });
    }

    const existingPkgs = await packages.list(orgId);
    for (const row of existingPkgs) {
      if (row?.id) await packages.remove(orgId, row.id);
    }
    for (const row of pkgItems) {
      if (row && typeof row === "object") await packages.add(orgId, { ...row, id: undefined });
    }

    const existingEmp = await employees.list(orgId);
    for (const row of existingEmp) {
      if (row?.id) await employees.remove(orgId, row.id);
    }
    for (const row of empList) {
      if (row && typeof row === "object") await employees.add(orgId, { ...row, id: undefined });
    }

    for (const [k, v] of Object.entries(finKv)) await finance.setKv(orgId, k, v);

    await inventory.set(orgId, inv);

    for (const [lineId, payload] of Object.entries(mapsObj)) {
      if (lineId && payload != null) await maps.set(orgId, lineId, payload);
    }

    await settings.set(orgId, { admin: sett?.admin ?? {} });
    return JSON.parse(JSON.stringify(snapshot));
  }

  backupMod = {
    get: (orgId) => db.get(orgId),
    set: (orgId, data) => db.set(orgId, data),
    buildSnapshot: (orgId) => buildSnapshot(orgId),
    restore: (orgId, snapshot) => applyRestore(orgId, snapshot),
  };
} else {
  backupMod = {
    get: () => getBackup(),
    set: (_orgId, data) => {
      setBackup(data);
      return Promise.resolve(data);
    },
    buildSnapshot: () => Promise.resolve(getFullState()),
    restore: (_orgId, snapshot) => {
      setFullState(snapshot);
      return Promise.resolve(getFullState());
    },
  };
}

export const backup = backupMod;
