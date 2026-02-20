/**
 * Central config - routes + nav. Single source for App and BottomNav.
 */
export const ROUTES = {
  HOME: "/",
  SUBSCRIBERS: "/subscribers",
  DISTRIBUTORS: "/distributors",
  PLANS: "/plans",
  MAP: "/map",
  PACKAGES: "/packages",
  DEVICES: "/devices",
  EMPLOYEE: "/employee",
  FINANCE: "/finance",
  SETTINGS: "/settings",
  ACTIVATE: "/activate",
};

export const NAV_ITEMS = [
  { to: ROUTES.HOME, label: "الرئيسية", icon: "🏠", end: true },
  { to: ROUTES.SUBSCRIBERS, label: "المشتركين", icon: "👥" },
  { to: ROUTES.DISTRIBUTORS, label: "الموزعين", icon: "🚚" },
  { to: ROUTES.PLANS, label: "خطوط الشبكة", icon: "📶" },
  { to: ROUTES.MAP, label: "الخريطة", icon: "🗺️", isMap: true },
  { to: ROUTES.PACKAGES, label: "الحزم", icon: "📦" },
  { to: ROUTES.DEVICES, label: "الاجهزة", icon: "🖧" },
  { to: ROUTES.EMPLOYEE, label: "الموظفين", icon: "🧑‍💼" },
  { to: ROUTES.FINANCE, label: "المالية", icon: "💰" },
  { to: ROUTES.SETTINGS, label: "الاعدادات", icon: "⚙️" },
];
