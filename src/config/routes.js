/**
 * Central config - routes + nav. Single source for App and BottomNav.
 */
export const ROUTES = {
  HOME: "/",
  SUBSCRIPTION_EXPIRED: "/subscription-expired",
  SUBSCRIBERS: "/subscribers",
  DISTRIBUTORS: "/distributors",
  LINES: "/lines",
  MAP: "/map",
  PACKAGES: "/packages",
  DEVICES: "/devices",
  EMPLOYEE: "/employee",
  FINANCE: "/finance",
  SETTINGS: "/settings",
};

/** Module key for plan/permission gating (must match server config/plans.js). */
export const ROUTE_MODULE_KEYS = {
  [ROUTES.HOME]: null,
  [ROUTES.SUBSCRIBERS]: "subscribers",
  [ROUTES.DISTRIBUTORS]: "distributors",
  [ROUTES.LINES]: "lines",
  [ROUTES.MAP]: "map",
  [ROUTES.PACKAGES]: "packages",
  [ROUTES.DEVICES]: "devices",
  [ROUTES.EMPLOYEE]: "employee",
  [ROUTES.FINANCE]: "finance",
  [ROUTES.SETTINGS]: "settings",
};

export const NAV_ITEMS = [
  { to: ROUTES.HOME, label: "الرئيسية", icon: "🏠", end: true, moduleKey: null },
  { to: ROUTES.SUBSCRIBERS, label: "المشتركين", icon: "👥", moduleKey: "subscribers" },
  { to: ROUTES.DISTRIBUTORS, label: "الموزعين", icon: "🚚", moduleKey: "distributors" },
  { to: ROUTES.LINES, label: "خطوط الشبكة", icon: "📶", moduleKey: "lines" },
  { to: ROUTES.MAP, label: "الخريطة", icon: "🗺️", isMap: true, moduleKey: "map" },
  { to: ROUTES.PACKAGES, label: "الحزم", icon: "📦", moduleKey: "packages" },
  { to: ROUTES.DEVICES, label: "الاجهزة", icon: "🖧", moduleKey: "devices" },
  { to: ROUTES.EMPLOYEE, label: "الموظفين", icon: "🧑‍💼", moduleKey: "employee" },
  { to: ROUTES.FINANCE, label: "المالية", icon: "💰", moduleKey: "finance" },
  { to: ROUTES.SETTINGS, label: "الاعدادات", icon: "⚙️", moduleKey: "settings" },
];
