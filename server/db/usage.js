/**
 * Compute current usage counts. Uses loaders (DB) when orgId provided, else store.
 */
import { state } from "./store.js";
import { lines } from "./lines-loader.js";
import { packages } from "./packages-loader.js";
import { subscribers } from "./subscribers-loader.js";
import { distributors } from "./distributors-loader.js";
import { employees } from "./employees-loader.js";
import { inventory } from "./inventory-loader.js";
import { finance } from "./finance-loader.js";

function safeArray(x) {
  return Array.isArray(x) ? x : [];
}

/** Safe run for a loader call; on error (e.g. table missing) return fallback. */
async function safeLoader(getValue, fallback) {
  try {
    return await getValue();
  } catch {
    return fallback;
  }
}

/** @param {string} [orgId] - When provided, counts use DB via loaders. */
export async function getUsage(orgId) {
  const lineItems = state.lines?.items ?? [];
  const linesCount =
    orgId != null && typeof lines.count === "function"
      ? await safeLoader(() => lines.count(orgId), lineItems.length)
      : lineItems.length;

  let packagesSubscriber = 0;
  let packagesDistributor = 0;
  if (orgId != null && typeof packages.countByTarget === "function") {
    const counts = await safeLoader(() => packages.countByTarget(orgId), { subscriber: 0, distributor: 0 });
    packagesSubscriber = counts.subscriber ?? 0;
    packagesDistributor = counts.distributor ?? 0;
  } else {
    const pkgItems = Array.isArray(state.packages) ? state.packages : (state.packages?.items ?? []);
    packagesSubscriber = pkgItems.filter((p) => p?.target === "subscriber").length;
    packagesDistributor = pkgItems.filter((p) => p?.target === "distributor").length;
  }

  let subscribersCount = state.subscribers?.length ?? 0;
  if (orgId != null && typeof subscribers.count === "function") {
    subscribersCount = await safeLoader(() => subscribers.count(orgId), subscribersCount);
  }

  let distributorsCount = state.distributors?.length ?? 0;
  if (orgId != null && typeof distributors.count === "function") {
    distributorsCount = await safeLoader(() => distributors.count(orgId), distributorsCount);
  }

  let employeesCount = state.employees?.length ?? 0;
  if (orgId != null && typeof employees.count === "function") {
    employeesCount = await safeLoader(() => employees.count(orgId), employeesCount);
  }

  let kv = {};
  try {
    kv = await finance.getKv(orgId);
  } catch {
    kv = {};
  }
  const manualInvoices = safeArray(kv.manualInvoices);

  let devicesStoresCount = (state.inventory?.warehouses ?? []).length;
  if (orgId != null && typeof inventory.get === "function") {
    const inv = await safeLoader(() => inventory.get(orgId), null);
    devicesStoresCount = inv && Array.isArray(inv.warehouses) ? inv.warehouses.length : devicesStoresCount;
  }

  const mapEntries = state.maps && typeof state.maps === "object" ? Object.entries(state.maps) : [];
  const nodesByLine = {};
  for (const [lineId, v] of mapEntries) {
    nodesByLine[lineId] = safeArray(v?.nodes).length;
  }

  return {
    subscribers: subscribersCount,
    distributors: distributorsCount,
    lines: linesCount,
    packagesSubscriber,
    packagesDistributor,
    employees: employeesCount,
    financeManual: manualInvoices.length,
    devicesStores: devicesStoresCount,
    mapNodesByLine: nodesByLine,
  };
}
