/**
 * Plan-based module visibility (must match server config/plans.js).
 * Used for nav gating and allowedModules when no API or as fallback.
 */

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
 * Whether a module is enabled for the given plan.
 */
export function isModuleEnabled(plan, moduleKey) {
  if (!plan) return true;
  switch (plan) {
    case "basic":
      return moduleKey !== "map" && moduleKey !== "devices";
    case "plus":
    case "pro":
      return true;
    default:
      return true;
  }
}

/**
 * List of module keys the plan allows (for nav and access).
 * When you add an account with a plan, this drives what they see.
 */
export function getEnabledModulesForPlan(plan) {
  if (!plan) return [...MODULE_KEYS];
  return MODULE_KEYS.filter((key) => isModuleEnabled(plan, key));
}
