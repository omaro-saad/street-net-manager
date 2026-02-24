/**
 * Centralized app initialization: load all required data for all modules after login.
 * Used by DataProvider when token is available (API mode). SplashScreen stays until this completes.
 */
import {
  apiSubscribersList,
  apiDistributorsList,
  apiLinesList,
  apiPackagesList,
  apiEmployeesList,
  apiInventoryGet,
  apiFinanceGet,
  apiSettingsGet,
} from "./api.js";

function safeArray(x) {
  return Array.isArray(x) ? x : [];
}
function safeObj(x) {
  return x && typeof x === "object" && !Array.isArray(x) ? x : {};
}

/**
 * Whether the user has access to the given module (avoids 403 by not calling the API).
 * When allowedModules is not yet loaded (undefined), returns false so we skip the request.
 * @param {string[]|Set<string>} allowedModules - from auth me
 * @param {string} key - module key (e.g. 'devices', 'settings')
 */
function hasModule(allowedModules, key) {
  if (allowedModules == null) return false;
  if (Array.isArray(allowedModules)) return allowedModules.includes(key);
  return allowedModules.has?.(key) ?? false;
}

/**
 * Fetch all critical data in parallel. Returns a single object to merge into DataContext.
 * Only requests modules the user is allowed to access (avoids 403 for plan-restricted modules).
 * @param {string} token - Auth token
 * @param {{ allowedModules?: string[] | Set<string> }} [options] - optional; when provided, skips inventory/settings if not allowed
 * @returns {Promise<Partial<object>>} Patch for setData
 */
export async function loadAllInitialData(token, options = {}) {
  if (!token) return {};

  const allowedModules = options.allowedModules;
  const [
    subscribersRes,
    distributorsRes,
    linesRes,
    packagesRes,
    employeesRes,
    inventoryRes,
    financeRes,
    settingsRes,
  ] = await Promise.all([
    apiSubscribersList(token),
    apiDistributorsList(token),
    apiLinesList(token),
    apiPackagesList(token),
    apiEmployeesList(token),
    hasModule(allowedModules, "devices") ? apiInventoryGet(token) : Promise.resolve({ ok: false }),
    apiFinanceGet(token),
    hasModule(allowedModules, "settings") ? apiSettingsGet(token) : Promise.resolve({ ok: false }),
  ]);

  const subscribers = subscribersRes.ok ? safeArray(subscribersRes.data) : [];
  const distributors = distributorsRes.ok ? safeArray(distributorsRes.data) : [];
  const linesData = linesRes.ok ? safeArray(linesRes.data) : [];
  const packagesData = packagesRes.ok ? safeArray(packagesRes.data) : [];
  const employees = employeesRes.ok ? safeArray(employeesRes.data) : [];
  const inventoryRaw = inventoryRes.ok && inventoryRes.data ? inventoryRes.data : null;
  const financeRaw = financeRes.ok && financeRes.data ? financeRes.data : {};

  const inventory = safeObj(inventoryRaw);
  if (!inventory.warehouses) inventory.warehouses = [];
  if (!inventory.sections) inventory.sections = [];
  if (!inventory.items) inventory.items = [];

  const financeKv = safeObj(financeRaw);
  const manualInvoices = safeArray(financeKv.manualInvoices ?? financeKv.manual_invoices);
  const autoInvoices = safeArray(financeKv.autoInvoices ?? financeKv.auto_invoices);

  const settingsRaw = settingsRes.ok && settingsRes.data ? settingsRes.data : null;
  const adminSettings = settingsRaw?.admin && typeof settingsRaw.admin === "object" ? settingsRaw.admin : {};

  return {
    subscribers,
    distributors,
    lines: Array.isArray(linesData) ? { items: linesData } : { items: [] },
    packages: Array.isArray(packagesData) ? { items: packagesData } : { items: [] },
    employees,
    inventory,
    finance: {
      _kv: {
        ...financeKv,
        manualInvoices,
        autoInvoices,
      },
    },
    settings: {
      admin: {
        theme: adminSettings.theme === "dark" ? "dark" : "light",
        companyName: typeof adminSettings.companyName === "string" ? adminSettings.companyName : "",
        companyAbout: typeof adminSettings.companyAbout === "string" ? adminSettings.companyAbout : "",
      },
    },
    updatedAt: Date.now(),
  };
}
