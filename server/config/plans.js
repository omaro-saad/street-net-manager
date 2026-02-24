/**
 * Plan limits and feature flags — Basic, Plus, Pro.
 * Do not change values; must match SAAS_SUBSCRIPTION_DESIGN.md.
 * null or -1 = unlimited.
 */

export const PLANS = {
  basic: {
    subscribers: 15,
    distributors: 7,
    lines: 3,
    mapsEnabled: false,
    mapNodesPerLine: 0,
    packagesSubscriber: 2,
    packagesDistributor: 2,
    devicesEnabled: false,
    devicesStores: 0,
    employees: 5,
    financeManual: 30,
    settingsEnabled: true,
  },
  plus: {
    subscribers: 30,
    distributors: 20,
    lines: 6,
    mapsEnabled: true,
    mapNodesPerLine: 10,
    packagesSubscriber: 8,
    packagesDistributor: 8,
    devicesEnabled: true,
    devicesStores: 5,
    employees: 9,
    financeManual: 60,
    settingsEnabled: true,
  },
  pro: {
    subscribers: null,
    distributors: null,
    lines: null,
    mapsEnabled: true,
    mapNodesPerLine: null,
    packagesSubscriber: null,
    packagesDistributor: null,
    devicesEnabled: true,
    devicesStores: null,
    employees: null,
    financeManual: null,
    settingsEnabled: true,
  },
};

/** Module keys for permissions (must match frontend routes). */
export const MODULE_KEYS = [
  "subscribers",
  "distributors",
  "lines",
  "map",
  "packages",
  "devices",
  "employee",
  "finance",
  "settings",
];

/**
 * Get limit value for a plan. Returns null for unlimited.
 */
export function getLimit(plan, key) {
  const p = PLANS[plan];
  if (!p || p[key] === undefined) return null;
  const v = p[key];
  if (v === null || v === -1) return null;
  return Number(v);
}

/**
 * Check if a module/feature is enabled for the plan.
 */
export function isModuleEnabled(plan, moduleKey) {
  const p = PLANS[plan];
  if (!p) return false;
  switch (moduleKey) {
    case "map":
      return !!p.mapsEnabled;
    case "devices":
      return !!p.devicesEnabled;
    case "subscribers":
    case "distributors":
    case "lines":
    case "packages":
    case "employee":
    case "finance":
    case "settings":
      return true;
    default:
      return false;
  }
}

/**
 * Modules that can be disabled by plan (for employee permission gating).
 */
export function getEnabledModulesForPlan(plan) {
  return MODULE_KEYS.filter((key) => isModuleEnabled(plan, key));
}
