// src/pages/SettingsPage.jsx
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";

/** Hook: true when viewport width is below the given px. */
function useMatchMedia(maxWidthPx) {
  const [match, setMatch] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < maxWidthPx : false
  );
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${maxWidthPx - 1}px)`);
    const update = () => setMatch(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, [maxWidthPx]);
  return match;
}
import { useAuth } from "../contexts/AuthContext.jsx";
import { useAlert } from "../contexts/AlertContext.jsx";
import { useData } from "../DataContext.jsx";
import { ROUTES } from "../config/routes.js";
import { useAsyncAction } from "../hooks/useAsyncAction.js";
import LoadingOverlay from "../components/LoadingOverlay.jsx";
import {
  isApiMode,
  apiUpdateUsername,
  apiResetPassword,
  apiListOusers,
  apiGetOuserPermissions,
  apiSetOuserPermissions,
  apiBackupPost,
  apiBackupRestore,
  apiDeleteAllData,
  apiSettingsPut,
  SUPPORT_EMAIL,
  SUPPORT_MAILTO,
} from "../lib/api.js";
import { MODULE_KEYS } from "../lib/plans.js";
import { theme } from "../theme.js";
import {
  pageWrap,
  emptyText,
  input,
  btnPrimary,
  btnOutline,
  miniLabel,
  contentCenterWrap,
} from "../styles/shared.js";

const TABS_BASE = [
  { key: "profile", label: "الملف الشخصي" },
  { key: "app", label: "إعدادات التطبيق" },
];

const MODULE_LABELS = {
  subscribers: "المشتركين",
  distributors: "الموزعين",
  lines: "الخطوط",
  map: "الخريطة",
  packages: "الباقات",
  devices: "الأجهزة",
  employee: "الموظفين",
  finance: "المالية",
  settings: "الإعدادات",
};

function formatTimeRemaining(endsAt) {
  if (!endsAt) return null;
  const end = new Date(endsAt);
  const now = new Date();
  if (end <= now) return "منتهي";
  const ms = end - now;
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  if (days >= 365) {
    const y = Math.floor(days / 365);
    const d = days % 365;
    return d ? `${y} سنة و ${d} يوم` : `${y} سنة`;
  }
  if (days >= 30) {
    const m = Math.floor(days / 30);
    const d = days % 30;
    return d ? `${m} شهر و ${d} يوم` : `${m} شهر`;
  }
  return `${days} يوم`;
}

const PLAN_LABELS = { basic: "أساسي", plus: "بلس", pro: "برو" };
const DURATION_LABELS = { monthly: "شهري", "3months": "٣ أشهر", yearly: "سنوي" };

const iconSize = 22;
const iconColor = "currentColor";
const ICON_CLOCK = (
  <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </svg>
);
const ICON_DOC = (
  <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
    <path d="M16 13H8" />
    <path d="M16 17H8" />
  </svg>
);
const ICON_SHIELD = (
  <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);
const ICON_USER = (
  <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);
const ICON_SUN = (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block", flexShrink: 0 }}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
  </svg>
);
const ICON_MOON = (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block", flexShrink: 0 }}>
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);
const ICON_PALETTE = (
  <svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block", margin: "0 auto 12px" }}>
    <circle cx="13.5" cy="6.5" r="1.5" fill="#ec4899" stroke="none" />
    <circle cx="17.5" cy="10.5" r="1.5" fill="#3b82f6" stroke="none" />
    <circle cx="8.5" cy="9.5" r="1.5" fill="#eab308" stroke="none" />
    <circle cx="11.5" cy="14.5" r="1.5" fill="#22c55e" stroke="none" />
    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 1.7-.2 2.4-.5" />
  </svg>
);
const ICON_BACKUP = (
  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block", flexShrink: 0 }}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);
const ICON_BUILDING = (
  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block", flexShrink: 0 }}>
    <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
    <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
    <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
    <path d="M10 6h4" />
    <path d="M10 10h4" />
    <path d="M10 14h4" />
  </svg>
);
const ICON_DOC_NOTES = (
  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block", flexShrink: 0 }}>
    <path d="M16 4H8a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-4Z" />
    <path d="M12 4v4h4" />
    <path d="M8 12h8" />
    <path d="M8 16h8" />
  </svg>
);
const ICON_SAVE = (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block", flexShrink: 0 }}>
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
    <path d="M17 21v-8H7v8" />
    <path d="M7 3v5h8" />
  </svg>
);
const iconSm = 18;
const ICON_LOCK = (
  <svg width={iconSm} height={iconSm} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: "block", flexShrink: 0 }}>
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);
const ICON_EYE = (
  <svg width={iconSm} height={iconSm} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: "block", flexShrink: 0 }}>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const ICON_CHECK = (
  <svg width={iconSm} height={iconSm} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ display: "block", flexShrink: 0 }}>
    <path d="M20 6L9 17l-5-5" />
  </svg>
);
const ICON_USERS = (
  <svg width={iconSm} height={iconSm} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: "block", flexShrink: 0 }}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
const ICON_INFO = (
  <svg width={iconSm} height={iconSm} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: "block", flexShrink: 0 }}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4M12 8h.01" />
  </svg>
);

export default function SettingsPage() {
  const navigate = useNavigate();
  const { data, setData } = useData();
  const [tab, setTab] = useState("profile");
  const { user, token, updateUser, logout, role, subscription, oadminUsername, allowedModules: authAllowedModules } = useAuth();
  const { showValidationAlert, showErrorAlert, showSuccessAlert } = useAlert();
  const { execute, isLoading: actionLoading } = useAsyncAction({ minLoadingMs: 1000 });

  const handleLogout = () => {
    logout();
    navigate(ROUTES.HOME, { replace: true });
  };

  const TABS = role === "oadmin" ? [...TABS_BASE, { key: "ousers", label: "صلاحيات المستخدمين" }] : TABS_BASE;

  const adminSettings = (data?.settings?.admin) || {};

  const themeTrackRef = useRef(null);
  const [themeThumbLeft, setThemeThumbLeft] = useState(25);
  const TRACK_PAD = 25;
  const THUMB_WIDTH = 100;
  useEffect(() => {
    if (tab !== "app") return;
    const measure = () => {
      if (!themeTrackRef.current) return;
      const trackW = themeTrackRef.current.offsetWidth;
      setThemeThumbLeft(adminSettings.theme === "light" ? TRACK_PAD : trackW - TRACK_PAD - THUMB_WIDTH);
    };
    measure();
    const t = setTimeout(measure, 80);
    return () => clearTimeout(t);
  }, [tab, adminSettings.theme]);

  // ——— Change username (with secret code, like password) ———
  const [usernameFormOpen, setUsernameFormOpen] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [usernameSecretCode, setUsernameSecretCode] = useState("");
  const handleUpdateUsername = async (e) => {
    e.preventDefault();
    const v = String(newUsername ?? "").trim();
    const code = String(usernameSecretCode ?? "").trim();
    if (!v) {
      showValidationAlert("أدخل اسم المستخدم الجديد.", "اسم المستخدم");
      return;
    }
    if (!code) {
      showValidationAlert("أدخل الرمز السري للتحقق.", "الرمز السري");
      return;
    }
    if (!isApiMode() || !token) {
      showErrorAlert("تحديث اسم المستخدم متاح فقط عند الاتصال بالخادم.");
      return;
    }
    await execute(async () => {
      const res = await apiUpdateUsername(token, v, code);
      if (!res.ok) {
        showErrorAlert(res.error);
        return;
      }
      updateUser(res.user);
      setNewUsername("");
      setUsernameSecretCode("");
      setUsernameFormOpen(false);
      showSuccessAlert("تم تحديث اسم المستخدم بنجاح.");
    });
  };

  // ——— Reset password ———
  const [resetUsername, setResetUsername] = useState(user?.username ?? "");
  useEffect(() => {
    setResetUsername(user?.username ?? "");
  }, [user?.username]);
  const [resetCode, setResetCode] = useState("");
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [resetConfirmPassword, setResetConfirmPassword] = useState("");
  const [resetFormOpen, setResetFormOpen] = useState(false);
  const handleResetPassword = async (e) => {
    e.preventDefault();
    const u = String(resetUsername ?? "").trim();
    const code = String(resetCode ?? "").trim();
    const newP = String(resetNewPassword ?? "").trim();
    const confirmP = String(resetConfirmPassword ?? "").trim();
    if (!u || !code) {
      showValidationAlert("أدخل اسم المستخدم ورمز إعادة التعيين.", "التحقق");
      return;
    }
    if (newP.length < 4) {
      showValidationAlert("كلمة المرور الجديدة يجب أن تكون 4 أحرف على الأقل.", "كلمة المرور");
      return;
    }
    if (newP !== confirmP) {
      showValidationAlert("كلمة المرور وتأكيدها غير متطابقتين.", "التأكيد");
      return;
    }
    if (!isApiMode()) {
      showErrorAlert("إعادة تعيين كلمة المرور متاحة فقط عند الاتصال بالخادم.");
      return;
    }
    await execute(async () => {
      const res = await apiResetPassword(u, code, newP);
      if (!res.ok) {
        showErrorAlert(res.error);
        return;
      }
      showSuccessAlert(res.message || "تم تحديث كلمة المرور بنجاح.");
      setResetCode("");
      setResetNewPassword("");
      setResetConfirmPassword("");
      setResetFormOpen(false);
    });
  };

  // ——— Ouser settings (Oadmin only) ———
  const [ousers, setOusers] = useState([]);
  const [selectedOuserId, setSelectedOuserId] = useState(null);
  const [ouserAllowedModules, setOuserAllowedModules] = useState([]);
  /** Per-module: "no_access" | "read" | "read_write" */
  const [ouserPermissions, setOuserPermissions] = useState({});
  const [ousersLoading, setOusersLoading] = useState(false);
  const [ouserPermsLoading, setOuserPermsLoading] = useState(false);
  const oadminModuleSet = useCallback(() => {
    const arr = Array.isArray(authAllowedModules) ? authAllowedModules : [];
    return new Set(Array.isArray(arr) ? arr : []);
  }, [authAllowedModules]);

  const loadOusers = useCallback(async () => {
    if (!isApiMode() || !token || role !== "oadmin") return;
    setOusersLoading(true);
    try {
      const res = await apiListOusers(token);
      if (res.ok) setOusers(res.ousers || []);
      else showErrorAlert(res.error);
    } finally {
      setOusersLoading(false);
    }
  }, [token, role, showErrorAlert]);

  // ——— Backup / Restore (admin only, API mode) ———
  const [backupRestoreLoading, setBackupRestoreLoading] = useState(false);
  const buildBackupSnapshot = useCallback(() => {
    const d = data || {};
    return {
      subscribers: Array.isArray(d.subscribers) ? d.subscribers : [],
      distributors: Array.isArray(d.distributors) ? d.distributors : [],
      employees: Array.isArray(d.employees) ? d.employees : [],
      lines: d.lines && typeof d.lines === "object" ? { items: Array.isArray(d.lines.items) ? d.lines.items : [] } : { items: [] },
      packages: d.packages && typeof d.packages === "object" ? (Array.isArray(d.packages.items) ? { items: d.packages.items } : d.packages) : { items: [] },
      finance: d.finance && typeof d.finance === "object" ? d.finance : { _kv: {} },
      inventory: d.inventory && typeof d.inventory === "object" ? d.inventory : { warehouses: [], sections: [], items: [] },
      maps: d.maps && typeof d.maps === "object" ? d.maps : {},
      settings: d.settings && typeof d.settings === "object" ? d.settings : {},
      updatedAt: Date.now(),
    };
  }, [data]);
  const handleBackup = useCallback(async () => {
    if (!isApiMode() || !token || role !== "oadmin") return;
    setBackupRestoreLoading(true);
    try {
      const snapshot = buildBackupSnapshot();
      const res = await apiBackupPost(token, snapshot);
      if (res.ok) showSuccessAlert(res.message || "تم حفظ النسخة الاحتياطية.");
      else showErrorAlert(res.error);
    } finally {
      setBackupRestoreLoading(false);
    }
  }, [token, role, buildBackupSnapshot, showSuccessAlert, showErrorAlert]);
  const handleRestore = useCallback(async () => {
    if (!isApiMode() || !token || role !== "oadmin") return;
    if (!window.confirm("استعادة النسخة الاحتياطية ستستبدل كل البيانات الحالية. هل تريد المتابعة؟")) return;
    setBackupRestoreLoading(true);
    try {
      const res = await apiBackupRestore(token);
      if (res.ok && res.data) {
        setData(res.data);
        showSuccessAlert(res.message || "تم استعادة النسخة الاحتياطية.");
      } else {
        showErrorAlert(res?.error || "لا توجد نسخة احتياطية أو فشل الاستعادة.");
      }
    } finally {
      setBackupRestoreLoading(false);
    }
  }, [token, role, setData, showSuccessAlert, showErrorAlert]);

  // ——— Delete all data (admin only; two-step confirm then logout) ———
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const handleDeleteAllData = async () => {
    if (!showDeleteAllConfirm) {
      setShowDeleteAllConfirm(true);
      return;
    }
    if (!isApiMode() || !token) {
      showErrorAlert("حذف البيانات متاح فقط عند الاتصال بالخادم.");
      return;
    }
    await execute(async () => {
      const res = await apiDeleteAllData(token);
      if (!res.ok) {
        showErrorAlert(res.error);
        return;
      }
      showSuccessAlert(res.message || "تم حذف كل البيانات.");
      setShowDeleteAllConfirm(false);
      handleLogout();
    });
  };

  useEffect(() => {
    if (tab === "ousers") loadOusers();
  }, [tab, loadOusers]);

  useEffect(() => {
    if (tab !== "ousers" || !selectedOuserId) {
      setOuserAllowedModules([]);
      setOuserPermissions({});
      return;
    }
    let cancelled = false;
    setOuserPermsLoading(true);
    apiGetOuserPermissions(token, selectedOuserId).then((res) => {
      if (cancelled) return;
      setOuserPermsLoading(false);
      if (!res.ok) {
        showErrorAlert(res.error);
        return;
      }
      const allowed = res.allowedModules || [];
      const permsMap = res.permissions || {};
      setOuserAllowedModules(allowed);
      const next = {};
      MODULE_KEYS.forEach((k) => {
        next[k] = permsMap[k] === "read" || permsMap[k] === "read_write" ? permsMap[k] : "no_access";
      });
      setOuserPermissions(next);
    });
    return () => { cancelled = true; };
  }, [tab, selectedOuserId, token, showErrorAlert]);

  const handleOuserPermissionChange = (moduleKey, value) => {
    setOuserPermissions((prev) => ({ ...prev, [moduleKey]: value }));
  };

  const handleSaveOuserPermissions = async () => {
    if (!selectedOuserId || !token) return;
    const perms = {};
    MODULE_KEYS.forEach((k) => {
      const v = ouserPermissions[k];
      if (v === "read" || v === "read_write") perms[k] = v;
    });
    await execute(async () => {
      const res = await apiSetOuserPermissions(token, selectedOuserId, perms);
      if (res.ok) {
        showSuccessAlert("تم حفظ صلاحيات المستخدم.");
        setOuserAllowedModules(Object.keys(res.permissions || {}));
      } else showErrorAlert(res.error);
    });
  };

  const adminCanAccess = oadminModuleSet();

  const isNarrow = useMatchMedia(768);
  const isCompact = useMatchMedia(480);
  const r = useMemo(
    () => ({
      pageWrap: { padding: isCompact ? 10 : isNarrow ? 14 : 20 },
      headerCard: { padding: isCompact ? 12 : isNarrow ? 16 : 20 },
      pageTitle: { fontSize: isCompact ? 20 : isNarrow ? 22 : 26 },
      pageHint: { fontSize: isCompact ? 13 : 14 },
      tabsRow: { gap: isCompact ? 6 : 10 },
      tabBtn: { padding: isCompact ? "8px 14px" : "10px 20px", fontSize: isCompact ? 13 : 14 },
      tabBtnActive: { padding: isCompact ? "8px 14px" : "10px 20px", fontSize: isCompact ? 13 : 14 },
      scrollArea: { padding: isCompact ? 10 : isNarrow ? 12 : 16 },
      profileSection: { padding: isCompact ? 14 : isNarrow ? 20 : 28, gap: isCompact ? 18 : 28 },
      infoCardsRow: isNarrow
        ? { gridTemplateColumns: isCompact ? "1fr" : "repeat(2, 1fr)", gap: isCompact ? 10 : 16 }
        : {},
      profileCard: { padding: isCompact ? "12px 14px" : "18px 20px" },
      profileCardValue: { fontSize: isCompact ? 15 : 18 },
      actionCardsRow: isNarrow ? { gridTemplateColumns: "1fr", gap: isCompact ? 14 : 24 } : {},
      actionCard: {
        padding: isCompact ? 14 : isNarrow ? 18 : 24,
        minHeight: isCompact ? 160 : isNarrow ? 200 : 220,
      },
      sectionCard: { padding: isCompact ? 14 : isNarrow ? 18 : 24 },
      appSettingsSection: { padding: isCompact ? 14 : isNarrow ? 20 : 28, gap: isCompact ? 16 : 24 },
      appSettingsTitle: { fontSize: isCompact ? 18 : isNarrow ? 20 : 22 },
      appSettingsGrid: isNarrow ? { gridTemplateColumns: "1fr", gap: isCompact ? 14 : 24 } : {},
      appSettingsCard: { padding: isCompact ? 14 : isNarrow ? 18 : 24 },
      appSettingsCardPlaceholder: { padding: isCompact ? 16 : 28, minHeight: isCompact ? 120 : 160 },
      themeSwitchTrack: { padding: isCompact ? "0 12px" : "0 25px", height: isCompact ? 44 : 48 },
      themeSwitchThumb: { padding: isCompact ? "0 10px" : "0 14px" },
      appSettingsSaveRow: { justifyContent: isCompact ? "stretch" : "flex-end" },
      btnSaveChanges: { padding: isCompact ? "12px 16px" : "14px 24px", fontSize: isCompact ? 14 : 15 },
      ousersWrap: { padding: isCompact ? 14 : isNarrow ? 20 : 28 },
      ousersTopRow: isNarrow ? { gridTemplateColumns: "1fr", gap: isCompact ? 14 : 24 } : {},
      ousersSummaryCard: { padding: isCompact ? 12 : 20, flex: isCompact ? "1 1 100%" : "1 1 140px" },
      ousersSummaryValue: { fontSize: isCompact ? 20 : 24 },
      ousersPermsSection: { padding: isCompact ? 14 : 24 },
      ousersPermsGrid: isNarrow ? { gridTemplateColumns: "1fr", gap: 12 } : {},
      ousersPermRow: { flexDirection: isCompact ? "column" : "row", alignItems: isCompact ? "stretch" : "center", gap: 8 },
      formCol: { maxWidth: isNarrow ? "100%" : 400 },
      fieldBlock: { maxWidth: isNarrow ? "100%" : 400 },
      emptyState: { padding: isCompact ? 16 : 24, minHeight: isCompact ? 140 : 180 },
    }),
    [isNarrow, isCompact]
  );

  return (
    <div style={{ ...pageWrap, flex: 1, minHeight: 0, boxSizing: "border-box", overflowX: "hidden", ...r.pageWrap }}>
      <LoadingOverlay visible={actionLoading} />
      <div style={{ ...headerCard, ...r.headerCard }}>
        <h1 style={{ ...pageTitle, ...r.pageTitle }}>الإعدادات</h1>
        <p style={{ ...pageHint, ...r.pageHint }}>التحكم في الملف الشخصي وإعدادات التطبيق</p>
        <div style={{ ...tabsRow, ...r.tabsRow }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              style={tab === t.key ? { ...tabBtnActive, ...r.tabBtnActive } : { ...tabBtn, ...r.tabBtn }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ ...scrollArea, ...r.scrollArea }}>
      {tab === "profile" && (
        <div style={{ ...profileSection, ...r.profileSection }}>
          {!isApiMode() && (
            <div style={noticeBox}>
              <span style={noticeText}>تحديث الملف الشخصي متاح عند الاتصال بالخادم (وضع API).</span>
            </div>
          )}

          {/* Row 1: Four info cards — order matches reference (RTL: المتبقي، الاشتراك، الدور، الحساب) */}
          <div style={{ ...infoCardsRow, ...r.infoCardsRow }}>
            <div style={{ ...profileCard, ...r.profileCard }}>
              <div style={profileCardIconWrap}>{ICON_USER}</div>
              <div style={profileCardLabel}>الحساب</div>
              <div style={{ ...profileCardValue, ...r.profileCardValue }}>{user?.username ?? "—"}</div>
              <div style={profileCardMeta}>اسم المستخدم</div>
            </div>
            <div style={{ ...profileCard, ...r.profileCard }}>
              <div style={profileCardIconWrap}>{ICON_SHIELD}</div>
              <div style={profileCardLabel}>الدور</div>
              <div style={{ ...profileCardValue, ...r.profileCardValue }}>{role === "oadmin" ? "مدير" : "مستخدم"}</div>
              <div style={profileCardMeta}>{role === "oadmin" ? "Admin" : "User"}</div>
            </div>
            <div style={{ ...profileCard, ...r.profileCard }}>
              <div style={profileCardIconWrap}>{ICON_DOC}</div>
              <div style={profileCardLabel}>الاشتراك</div>
              <div style={{ ...profileCardValue, ...r.profileCardValue }}>
                {isApiMode() && subscription ? (PLAN_LABELS[subscription.plan] ?? subscription.plan) : "—"}
              </div>
              <div style={profileCardMeta}>
                {isApiMode() && subscription ? (DURATION_LABELS[subscription.duration] ?? subscription.duration) : "—"}
              </div>
            </div>
            <div style={{ ...profileCard, ...r.profileCard }}>
              <div style={profileCardIconWrap}>{ICON_CLOCK}</div>
              <div style={profileCardLabel}>المتبقي</div>
              <div style={{ ...profileCardValue, ...r.profileCardValue, color: theme.primary }}>
                {isApiMode() && subscription ? (formatTimeRemaining(subscription.endsAt) ?? "—") : "—"}
              </div>
              <div style={profileCardMeta}>من انتهاء الاشتراك</div>
            </div>
          </div>

          {/* Row 2: Two action cards — تغيير كلمة المرور (right), تغيير الاسم (left) */}
          <div style={{ ...actionCardsRow, ...r.actionCardsRow }}>
            <div style={{ ...actionCard, ...r.actionCard }}>
              <h3 style={actionCardTitle}>تغيير كلمة المرور</h3>
              <p style={actionCardDesc}>تحتاج إلى رمز إعادة التعيين السري (تُعطى عند إنشاء الحساب).</p>
              <div style={actionCardContent}>
                {resetFormOpen && (
                  <form id="password-form" onSubmit={handleResetPassword} style={{ ...formCol, ...r.formCol }}>
                    <div style={{ ...fieldBlock, ...r.fieldBlock }}>
                      <label style={miniLabel}>اسم المستخدم</label>
                      <input type="text" style={input} value={resetUsername} onChange={(e) => setResetUsername(e.target.value)} placeholder="اسم المستخدم" disabled={actionLoading} autoComplete="username" />
                    </div>
                    <div style={{ ...fieldBlock, ...r.fieldBlock }}>
                      <label style={miniLabel}>رمز إعادة التعيين السري</label>
                      <input type="password" style={input} value={resetCode} onChange={(e) => setResetCode(e.target.value)} placeholder="أدخل الرمز السري" disabled={actionLoading} autoComplete="off" />
                    </div>
                    <div style={{ ...fieldBlock, ...r.fieldBlock }}>
                      <label style={miniLabel}>كلمة المرور الجديدة</label>
                      <input type="password" style={input} value={resetNewPassword} onChange={(e) => setResetNewPassword(e.target.value)} placeholder="4 أحرف على الأقل" disabled={actionLoading} autoComplete="new-password" />
                    </div>
                    <div style={{ ...fieldBlock, ...r.fieldBlock }}>
                      <label style={miniLabel}>تأكيد كلمة المرور الجديدة</label>
                      <input type="password" style={input} value={resetConfirmPassword} onChange={(e) => setResetConfirmPassword(e.target.value)} placeholder="أعد إدخال كلمة المرور" disabled={actionLoading} autoComplete="new-password" />
                    </div>
                  </form>
                )}
              </div>
              <div style={actionCardActions}>
                {!resetFormOpen ? (
                  <button type="button" style={{...btnOpenForm, color: theme.text}} onClick={() => setResetFormOpen(true)}>
                    افتح النموذج
                  </button>
                ) : (
                  <div style={buttonRow}>
                    <button type="button" style={btnOutline} onClick={() => setResetFormOpen(false)} disabled={actionLoading}>إلغاء</button>
                    <button type="submit" form="password-form" style={btnPrimary} disabled={actionLoading}>{actionLoading ? "جاري الحفظ..." : "تحديث كلمة المرور"}</button>
                  </div>
                )}
              </div>
            </div>
            <div style={{ ...actionCard, ...r.actionCard }}>
              <h3 style={actionCardTitle}>تغيير الاسم</h3>
              <p style={actionCardDesc}>تحتاج إلى رمز إعادة التعيين السري (تُعطى عند إنشاء الحساب).</p>
              <div style={actionCardContent}>
                {usernameFormOpen && (
                  <form id="username-form" onSubmit={handleUpdateUsername} style={{ ...formCol, ...r.formCol }}>
                    <div style={{ ...fieldBlock, ...r.fieldBlock }}>
                      <label style={miniLabel}>اسم المستخدم الجديد</label>
                      <input
                        type="text"
                        style={input}
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                        placeholder="اسم المستخدم الجديد"
                        disabled={actionLoading || !isApiMode()}
                        autoComplete="username"
                      />
                    </div>
                    <div style={{ ...fieldBlock, ...r.fieldBlock }}>
                      <label style={miniLabel}>الرمز السري (للتحقق)</label>
                      <input
                        type="password"
                        style={input}
                        value={usernameSecretCode}
                        onChange={(e) => setUsernameSecretCode(e.target.value)}
                        placeholder="أدخل الرمز السري"
                        disabled={actionLoading || !isApiMode()}
                        autoComplete="off"
                      />
                    </div>
                  </form>
                )}
              </div>
              <div style={actionCardActions}>
                {!usernameFormOpen ? (
                  <button type="button" style={{...btnOpenForm, color: theme.text}} onClick={() => setUsernameFormOpen(true)} disabled={!isApiMode()}>
                    افتح النموذج
                  </button>
                ) : (
                  <div style={buttonRow}>
                    <button type="button" style={btnOutline} onClick={() => { setUsernameFormOpen(false); setNewUsername(""); setUsernameSecretCode(""); }} disabled={actionLoading}>إلغاء</button>
                    <button type="submit" form="username-form" style={btnPrimary} disabled={actionLoading || !isApiMode()}>
                      {actionLoading ? "جاري الحفظ..." : "حفظ الاسم"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Row 3: Contact support + Logout */}
          <div style={actionCardsRow}>
            <div style={{ ...actionCard, ...r.actionCard }}>
              <h3 style={actionCardTitle}>Contact support</h3>
              <div style={actionCardContent} />
              <div style={actionCardActions}>
                <div style={supportLinksWrap}>
                  <a href={SUPPORT_MAILTO} style={textLink}>contact support team</a>
                  <a href={SUPPORT_MAILTO} style={textLink}>{SUPPORT_EMAIL}</a>
                </div>
              </div>
            </div>
            <div style={{ ...actionCard, ...r.actionCard }}>
              <h3 style={actionCardTitle}>تسجيل الخروج</h3>
              <p style={actionCardDesc}>إنهاء الجلسة الحالية والعودة لشاشة تسجيل الدخول.</p>
              <div style={actionCardContent} />
              <div style={actionCardActions}>
                <button type="button" style={btnLogout} onClick={handleLogout} disabled={actionLoading}>
                  تسجيل الخروج
                </button>
              </div>
            </div>
          </div>

          {/* Delete all data (admin only, API mode) — full width, two-step confirm */}
          {role === "oadmin" && isApiMode() && (
            <div style={{ ...actionCard, ...r.actionCard, width: "100%", maxWidth: "100%" }}>
              <h3 style={{ ...actionCardTitle, color: theme.error }}>حذف كل البيانات</h3>
              {!showDeleteAllConfirm ? (
                <>
                  <p style={actionCardDesc}>
                    حذف كل بيانات المنظمة نهائياً (مشتركين، موزعين، خطوط، باقات، موظفين، مالية، مخزون، خرائط، إعدادات). تبقى النسخة الاحتياطية وحسابات المسؤولين والمستخدمين. سيتم تسجيل خروجك بعد الحذف.
                  </p>
                  <div style={actionCardContent} />
                  <div style={actionCardActions}>
                    <button type="button" style={btnDeleteAll} onClick={handleDeleteAllData} disabled={actionLoading}>
                      حذف كل البيانات
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p style={deleteAllWarningText}>
                    هل أنت متأكد؟ لا يمكن التراجع. سيتم حذف كل البيانات (ما عدا النسخة الاحتياطية والحسابات) ثم تسجيل خروجك.
                  </p>
                  <div style={actionCardContent} />
                  <div style={{ ...actionCardActions, flexDirection: "column", gap: 14, width: "100%", paddingTop: 8 }}>
                    <button type="button" style={btnDeleteAllConfirm} onClick={handleDeleteAllData} disabled={actionLoading}>
                      {actionLoading ? "جاري الحذف..." : "أنا متأكد — احذف كل البيانات"}
                    </button>
                    <button type="button" style={btnDeleteAllCancel} onClick={() => setShowDeleteAllConfirm(false)} disabled={actionLoading}>
                      إلغاء
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {tab === "ousers" && (
        <div style={{ ...ousersWrap, ...r.ousersWrap }}>
          {/* Header */}
          <div style={ousersHeader}>
            <div style={ousersHeaderIconWrap}>
              {ICON_SHIELD}
            </div>
            <div>
              <h2 style={ousersTitle}>صلاحيات المستخدمين (User)</h2>
              <p style={ousersSubtitle}>التحكم في وصول المستخدمين للصفحات</p>
            </div>
          </div>

          {!isApiMode() || !token ? (
            <div style={noticeBox}>
              <span style={noticeText}>هذا القسم متاح عند الاتصال بالخادم.</span>
            </div>
          ) : ousersLoading ? (
            <div style={contentCenterWrap}>
              <p style={emptyText}>جاري تحميل القائمة...</p>
            </div>
          ) : ousers.length === 0 ? (
            <div style={contentCenterWrap}>
              <div style={{ ...emptyState, ...r.emptyState }}>
                <p style={emptyTitle}>لا يوجد مستخدمون (User)</p>
                <p style={emptyText}>يتم إنشاء المستخدمين الإضافيين عبر أداة سطر الأوامر أو من خلال الدعم.</p>
              </div>
            </div>
          ) : (
            <>
              {/* Top row: Summary cards + User selection */}
              <div style={{ ...ousersTopRow, ...r.ousersTopRow }}>
                <div style={ousersSummaryCards}>
                  <div style={{ ...ousersSummaryCard, ...r.ousersSummaryCard }}>
                    <span style={ousersSummaryIcon}>{ICON_LOCK}</span>
                    <span style={ousersSummaryLabel}>مقفلة</span>
                    <span style={{ ...ousersSummaryValue, ...r.ousersSummaryValue }}>{MODULE_KEYS.filter((k) => !adminCanAccess.has(k)).length}</span>
                    <span style={ousersSummaryMeta}>خارج الخطة</span>
                  </div>
                  <div style={{ ...ousersSummaryCard, ...r.ousersSummaryCard }}>
                    <span style={ousersSummaryIcon}>{ICON_EYE}</span>
                    <span style={ousersSummaryLabel}>مفعلة</span>
                    <span style={{ ...ousersSummaryValue, ...r.ousersSummaryValue }}>{MODULE_KEYS.filter((k) => adminCanAccess.has(k)).length}</span>
                    <span style={ousersSummaryMeta}>صفحة متاحة</span>
                  </div>
                </div>
                <div style={ousersUserCard}>
                  <div style={ousersUserCardHeader}>
                    <span style={ousersUserCardIcon}>{ICON_USERS}</span>
                    <div>
                      <div style={ousersUserCardTitle}>اختيار المستخدم</div>
                      <div style={ousersUserCardSubtitle}>حدد المستخدم لتعديل صلاحياته</div>
                    </div>
                  </div>
                  <select
                    style={ousersSelect}
                    value={selectedOuserId ?? ""}
                    onChange={(e) => setSelectedOuserId(e.target.value || null)}
                    disabled={ouserPermsLoading}
                  >
                    <option value="">— اختر مستخدماً —</option>
                    {ousers.map((o) => (
                      <option key={o.id} value={o.id}>{o.username}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Info banner */}
              <div style={ousersInfoBanner}>
                <span style={ousersInfoIcon}>{ICON_INFO}</span>
                <p style={ousersInfoText}>
                  كل مستخدم (User) مرتبط بمدير الحساب (Admin). لا وصول = لا يستطيع فتح الصفحة. عرض فقط = يستطيع المشاهدة دون تعديل. عرض وتعديل = يستطيع المشاهدة والتعديل. الصفحات المقفلة خارج خطتك ولا يمكن تغييرها.
                </p>
              </div>

              {/* Page permissions */}
              {selectedOuserId && (
                <>
                  {ouserPermsLoading ? (
                    <div style={contentCenterWrap}>
                      <p style={emptyText}>جاري تحميل الصلاحيات...</p>
                    </div>
                  ) : (
                    <div style={{ ...ousersPermsSection, ...r.ousersPermsSection }}>
                      <div style={ousersHeader}>
                        <div style={ousersHeaderIconWrap}>
                          {ICON_SHIELD}
                        </div>
                        <div>
                          <h3 style={ousersPermsTitle}>صلاحيات الصفحات</h3>
                          <p style={ousersSubtitle}>حدد الصفحات المسموح للمستخدم بالوصول إليها</p>
                        </div>
                      </div>
                      <div style={{ ...ousersPermsGrid, ...r.ousersPermsGrid }}>
                        {MODULE_KEYS.map((key) => {
                          const locked = !adminCanAccess.has(key);
                          const value = ouserPermissions[key] || "no_access";
                          const isRead = value === "read";
                          const isReadWrite = value === "read_write";
                          return (
                            <div key={key} style={{ ...ousersPermRow, ...r.ousersPermRow }}>
                              <span style={ousersPermLabel}>{MODULE_LABELS[key] ?? key}</span>
                              {locked ? (
                                <span style={ousersPermLockedBadge}>{ICON_LOCK}</span>
                              ) : (
                                <select
                                  value={value}
                                  onChange={(e) => handleOuserPermissionChange(key, e.target.value)}
                                  style={ousersPermSelect}
                                  disabled={locked}
                                >
                                  <option value="no_access">لا وصول</option>
                                  <option value="read">عرض فقط</option>
                                  <option value="read_write">عرض وتعديل</option>
                                </select>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <div style={ousersSaveRow}>
                        <button
                          type="button"
                          style={ousersSaveBtn}
                          onClick={handleSaveOuserPermissions}
                          disabled={actionLoading}
                        >
                          {ICON_SAVE}
                          <span>{actionLoading ? "جاري الحفظ..." : "حفظ الصلاحيات"}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}

      {tab === "app" && (
        <div style={{ ...appSettingsSection, ...r.appSettingsSection }}>
          <h2 style={{ ...appSettingsTitle, ...r.appSettingsTitle }}>إعدادات التطبيق</h2>
          <p style={appSettingsSubtitle}>تخصيص مظهر التطبيق وبيانات الشركة</p>

          <div style={{ ...appSettingsGrid, ...r.appSettingsGrid }}>
            
            {/* Top right: theme */}
            <div style={{ ...appSettingsCard, ...r.appSettingsCard }}>
              <div style={appSettingsCardHeader}>
                <span style={{ color: theme.textMuted }}>{ICON_SUN}</span>
                <div>
                  <h3 style={appSettingsCardTitle}>المظهر (Theme)</h3>
                  <p style={appSettingsCardSubtitle}>اختر مظهر التطبيق المفضل</p>
                </div>
              </div>
              <div
                ref={themeTrackRef}
                role="switch"
                aria-checked={adminSettings.theme === "dark"}
                tabIndex={0}
                onClick={() => {
                  const next = adminSettings.theme === "dark" ? "light" : "dark";
                  setData((prev) => ({ ...prev, settings: { ...prev.settings, admin: { ...(prev.settings?.admin || {}), theme: next } } }));
                  if (typeof localStorage !== "undefined") localStorage.setItem("app_theme", next);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    const next = adminSettings.theme === "dark" ? "light" : "dark";
                    setData((prev) => ({ ...prev, settings: { ...prev.settings, admin: { ...(prev.settings?.admin || {}), theme: next } } }));
                    if (typeof localStorage !== "undefined") localStorage.setItem("app_theme", next);
                  }
                }}
                style={{ ...themeSwitchTrack, ...r.themeSwitchTrack }}
              >
                <span
                  style={{
                    ...themeSwitchThumb,
                    ...r.themeSwitchThumb,
                    left: themeThumbLeft,
                    width: THUMB_WIDTH,
                  }}
                >
                  <span style={themeSwitchThumbContent}>
                    {adminSettings.theme === "light" ? (
                      <>
                        {ICON_SUN}
                        <span>فاتح</span>
                      </>
                    ) : (
                      <>
                        {ICON_MOON}
                        <span>داكن</span>
                      </>
                    )}
                  </span>
                </span>
              </div>
            </div>
            
            {/* Top left: Backup & Restore (admin only, API mode) or placeholder */}
            {role === "oadmin" && isApiMode() ? (
              <div style={{ ...appSettingsCard, ...r.appSettingsCard }}>
                <div style={appSettingsCardHeader}>
                  <span style={{ color: theme.textMuted }}>{ICON_BACKUP}</span>
                  <div>
                    <h3 style={appSettingsCardTitle}>النسخ الاحتياطي والاستعادة</h3>
                    <p style={appSettingsCardSubtitle}>نسخة واحدة للمؤسسة — كل نسخ جديد يستبدل السابقة</p>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
                  <button
                    type="button"
                    style={{ ...btnPrimary, width: "100%", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                    onClick={handleBackup}
                    disabled={backupRestoreLoading}
                  >
                    {ICON_SAVE}
                    <span>{backupRestoreLoading ? "جاري..." : "إنشاء نسخة احتياطية"}</span>
                  </button>
                  <button
                    type="button"
                    style={{ ...btnOutline, color: theme.text, width: "100%", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                    onClick={handleRestore}
                    disabled={backupRestoreLoading}
                  >
                    <span>{backupRestoreLoading ? "جاري..." : "استعادة من النسخة الاحتياطية"}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ ...appSettingsCardPlaceholder, ...r.appSettingsCardPlaceholder }}>
                <div style={{ color: theme.textMuted }}>{ICON_PALETTE}</div>
                <p style={appSettingsPlaceholderText}>المزيد من خيارات التخصيص قريبا</p>
              </div>
            )}

            {/* Bottom right: company name */}
            <div style={{ ...appSettingsCard, ...r.appSettingsCard }}>
              <div style={appSettingsCardHeader}>
                <span style={{ color: theme.textMuted }}>{ICON_BUILDING}</span>
                <h3 style={appSettingsCardTitle}>اسم الشركة</h3>
              </div>
              <div style={appSettingsInputWrap}>
                <input
                  type="text"
                  style={input}
                  value={adminSettings.companyName ?? ""}
                  onChange={(e) =>
                    setData((prev) => ({
                      ...prev,
                      settings: { ...prev.settings, admin: { ...(prev.settings?.admin || {}), companyName: e.target.value } },
                    }))
                  }
                  placeholder="اسم الشركة"
                />
              </div>
            </div>

            {/* Bottom left: company description */}
            <div style={{ ...appSettingsCard, ...r.appSettingsCard }}>
              <div style={appSettingsCardHeader}>
                <span style={{ color: theme.textMuted }}>{ICON_DOC_NOTES}</span>
                <h3 style={appSettingsCardTitle}>وصف الشركة</h3>
              </div>
              <div style={appSettingsInputWrap}>
                <textarea
                  style={{ ...input, minHeight: 100, resize: "vertical" }}
                  value={adminSettings.companyAbout ?? ""}
                  onChange={(e) =>
                    setData((prev) => ({
                      ...prev,
                      settings: { ...prev.settings, admin: { ...(prev.settings?.admin || {}), companyAbout: e.target.value } },
                    }))
                  }
                  placeholder="وصف الشركة"
                  rows={3}
                />
              </div>
            </div>

            
          </div>

          <div style={{ ...appSettingsSaveRow, ...r.appSettingsSaveRow }}>
            <button
              type="button"
              style={{ ...btnSaveChanges, ...r.btnSaveChanges }}
              onClick={async () => {
                const themeVal = adminSettings.theme || "light";
                const companyName = adminSettings.companyName ?? "";
                const companyAbout = adminSettings.companyAbout ?? "";
                if (isApiMode() && token) {
                  const res = await apiSettingsPut(token, {
                    admin: { theme: themeVal, companyName, companyAbout },
                  });
                  if (res.ok && res.data?.admin) {
                    setData((prev) => ({
                      ...prev,
                      settings: {
                        ...prev.settings,
                        admin: { ...prev.settings?.admin, ...res.data.admin },
                      },
                    }));
                  } else if (!res.ok) {
                    showErrorAlert(res.error || "فشل حفظ الإعدادات.");
                    return;
                  }
                }
                if (typeof localStorage !== "undefined") {
                  localStorage.setItem("app_theme", themeVal);
                  try {
                    localStorage.setItem("app_settings_admin", JSON.stringify({
                      theme: themeVal,
                      companyName,
                      companyAbout,
                    }));
                  } catch (_) {}
                }
                showSuccessAlert("تم حفظ التغييرات.");
              }}
            >
              {ICON_SAVE}
              <span>حفظ التغييرات</span>
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

const scrollArea = {
  flex: 1,
  overflowY: "auto",
  display: "flex",
  flexDirection: "column",
  gap: 16,
  minHeight: 0,
};
const headerCard = {
  border: `1px solid ${theme.border}`,
  borderRadius: theme.borderRadius,
  background: theme.surface,
  padding: 20,
  display: "flex",
  flexDirection: "column",
  gap: 14,
  boxShadow: theme.shadow,
  flexShrink: 0,
};
const pageTitle = { fontSize: 26, fontWeight: 900, color: theme.text, margin: 0 };
const pageHint = { fontSize: 14, color: theme.textMuted, margin: 0, lineHeight: 1.6 };
const tabsRow = { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" };
const tabBtn = {
  padding: "10px 20px",
  borderRadius: theme.borderRadiusSm,
  border: `1px solid ${theme.border}`,
  background: theme.surfaceAlt,
  color: theme.text,
  fontWeight: 900,
  cursor: "pointer",
  fontSize: 14,
  whiteSpace: "nowrap",
  boxShadow: theme.shadowMd,
};
const tabBtnActive = {
  ...tabBtn,
  border: "none",
  background: theme.primary,
  color: "#fff",
  boxShadow: "0 4px 14px rgba(139,92,246,0.35)",
};
const btnOpenForm = {
  ...btnOutline,
  padding: "12px 20px",
  fontWeight: 800,
  color: "white",
  minWidth: 160,
};
const sectionCard = {
  border: `1px solid ${theme.border}`,
  borderRadius: theme.borderRadius,
  background: theme.surface,
  padding: 24,
  display: "flex",
  flexDirection: "column",
  gap: 16,
  boxShadow: theme.shadow,
};
const sectionHeader = { display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 };
const sectionTitle = { fontSize: 18, fontWeight: 900, color: theme.text };

const appSettingsSection = {
  border: `1px solid ${theme.border}`,
  borderRadius: theme.borderRadius,
  background: theme.surface,
  padding: 28,
  display: "flex",
  flexDirection: "column",
  gap: 24,
  boxShadow: theme.shadow,
};
const appSettingsTitle = { fontSize: 22, fontWeight: 900, color: theme.text, margin: 0 };
const appSettingsSubtitle = { fontSize: 14, color: theme.textMuted, margin: "0 0 8px 0", lineHeight: 1.5 };
const appSettingsGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(260px, 1fr))",
  gap: 24,
};
const appSettingsCard = {
  padding: 24,
  borderRadius: theme.borderRadius,
  background: theme.surfaceAlt,
  border: `1px solid ${theme.border}`,
  display: "flex",
  flexDirection: "column",
  gap: 14,
  boxShadow: theme.shadowMd,
};
const appSettingsCardPlaceholder = {
  padding: 28,
  borderRadius: theme.borderRadius,
  background: theme.surfaceAlt,
  border: `1px dashed ${theme.border}`,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 160,
  boxShadow: theme.shadowMd,
};
const appSettingsCardHeader = { display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" };
const appSettingsCardTitle = { fontSize: 16, fontWeight: 900, color: theme.text, margin: 0 };
const appSettingsCardSubtitle = { fontSize: 13, color: theme.textMuted, margin: "2px 0 0 0", lineHeight: 1.4 };
const appSettingsPlaceholderText = { fontSize: 14, fontWeight: 700, color: theme.textMuted, margin: 0, textAlign: "center" };
const themeSwitchTrack = {
  position: "relative",
  width: "100%",
  height: 48,
  borderRadius: 999,
  background: theme.surface,
  border: `2px solid ${theme.border}`,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0 10px",
  boxSizing: "border-box",
  overflow: "hidden",
  userSelect: "none",
};
const themeSwitchThumb = {
  position: "absolute",
  top: 5,
  height: 36,
  borderRadius: 999,
  background: theme.primaryGradient || theme.primary,
  boxShadow: "0 2px 12px rgba(139,92,246,0.45)",
  pointerEvents: "none",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "0 14px",
  boxSizing: "border-box",
  transition: "left 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)",
};
const themeSwitchThumbContent = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  fontSize: 13,
  fontWeight: 800,
  color: "#fff",
};
const appSettingsInputWrap = { width: "100%" };
const appSettingsSaveRow = { display: "flex", justifyContent: "flex-end", marginTop: 8 };
const btnSaveChanges = {
  display: "inline-flex",
  alignItems: "center",
  gap: 10,
  padding: "14px 24px",
  borderRadius: theme.borderRadius,
  border: "none",
  background: theme.primaryGradient || theme.primary,
  color: "#fff",
  fontWeight: 900,
  fontSize: 15,
  cursor: "pointer",
  boxShadow: "0 4px 14px rgba(139,92,246,0.35)",
};
const noticeBox = {
  padding: 12,
  borderRadius: theme.borderRadiusSm,
  background: "#fef3c7",
  border: `1px solid ${theme.warning}`,
};
const noticeText = { fontSize: 13, color: "#92400e", margin: 0, lineHeight: 1.6 };

const profileSection = {
  border: `1px solid ${theme.border}`,
  borderRadius: theme.borderRadius,
  background: theme.surface,
  padding: 28,
  display: "flex",
  flexDirection: "column",
  gap: 28,
  boxShadow: theme.shadow,
};
const infoCardsRow = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
  gap: 16,
};
const profileCard = {
  padding: "18px 20px",
  borderRadius: theme.borderRadius,
  background: theme.surfaceAlt,
  border: `1px solid ${theme.border}`,
  display: "flex",
  flexDirection: "column",
  gap: 6,
  boxShadow: theme.shadowMd,
};
const profileCardIconWrap = { width: 28, height: 28, color: theme.textMuted, marginBottom: 4 };
const profileCardLabel = { fontSize: 11, fontWeight: 700, color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.04em" };
const profileCardValue = { fontSize: 18, fontWeight: 800, color: theme.text };
const profileCardMeta = { fontSize: 12, color: theme.textMuted };

const actionCardsRow = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(260px, 1fr))",
  gap: 24,
};
const actionCard = {
  padding: 24,
  borderRadius: theme.borderRadius,
  background: theme.surfaceAlt,
  border: `1px solid ${theme.border}`,
  display: "flex",
  flexDirection: "column",
  gap: 12,
  boxShadow: theme.shadowMd,
  minHeight: 220,
};
const actionCardTitle = { fontSize: 16, fontWeight: 900, color: theme.text, margin: 0 };
const actionCardDesc = { fontSize: 13, color: theme.textMuted, margin: 0, lineHeight: 1.5 };
const actionCardContent = { flex: 1, minHeight: 0 };
const actionCardActions = { marginTop: "auto", paddingTop: 4 };
const supportLinksWrap = { display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" };
const textLink = {
  color: theme.primary,
  fontSize: 14,
  fontWeight: 700,
  textDecoration: "none",
};
const profileBlock = { padding: "12px 0", borderTop: `1px solid ${theme.border}` };
const profileBlockLabel = { fontSize: 14, fontWeight: 700, color: theme.text };
const profileBlockHint = { fontSize: 12, color: theme.textMuted, marginTop: 4 };

const subsection = { display: "flex", flexDirection: "column", gap: 10 };
const subTitle = { fontSize: 16, fontWeight: 900, color: theme.text, margin: "0 0 4px 0" };
const formRow = { display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" };
const formCol = { display: "flex", flexDirection: "column", gap: 14, maxWidth: 400 };
const fieldBlock = { display: "flex", flexDirection: "column", gap: 6, maxWidth: 400 };
const buttonRow = { display: "flex", gap: 12, flexWrap: "wrap" };
const btnLogout = {
  padding: "12px 20px",
  borderRadius: 999,
  border: `1px solid ${theme.error}`,
  background: theme.surface,
  color: theme.error,
  fontWeight: 800,
  fontSize: 14,
  cursor: "pointer",
  minWidth: 160,
};
const btnDeleteAll = {
  width: "100%",
  padding: "14px 20px",
  borderRadius: theme.borderRadius,
  border: `2px solid ${theme.error}`,
  background: theme.surface,
  color: theme.error,
  fontWeight: 800,
  fontSize: 15,
  cursor: "pointer",
  boxSizing: "border-box",
};
const btnDeleteAllConfirm = {
  width: "100%",
  padding: "14px 20px",
  borderRadius: theme.borderRadius,
  border: "none",
  background: theme.error,
  color: "#fff",
  fontWeight: 800,
  fontSize: 15,
  cursor: "pointer",
  boxSizing: "border-box",
};
const btnDeleteAllCancel = {
  width: "100%",
  padding: "14px 20px",
  borderRadius: theme.borderRadius,
  border: `1px solid ${theme.border}`,
  background: theme.surfaceAlt || theme.surface,
  color: theme.textMuted || theme.text,
  fontWeight: 700,
  fontSize: 15,
  cursor: "pointer",
  marginTop: 15,
  boxSizing: "border-box",
};
const deleteAllWarningText = {
  fontSize: 14,
  color: theme.text,
  fontWeight: 600,
  margin: 0,
  padding: "12px 0 0 0",
  lineHeight: 1.5,
};
const emptyState = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 180,
  padding: 24,
  textAlign: "center",
  background: theme.surfaceAlt,
  borderRadius: theme.borderRadiusSm,
  border: `1px dashed ${theme.border}`,
};
const emptyIcon = { fontSize: 48, marginBottom: 12, opacity: 0.9 };
const emptyTitle = { fontSize: 16, fontWeight: 900, color: theme.text, margin: "0 0 8px 0" };
const checkboxSection = { display: "flex", flexDirection: "column", gap: 16 };
const checkboxSectionTitle = { fontSize: 14, fontWeight: 800, color: theme.text };
const checkboxGrid = { display: "flex", flexWrap: "wrap", gap: "12px 24px" };
const checkboxLabel = { display: "flex", alignItems: "center", gap: 10, fontSize: 14, fontWeight: 600, color: theme.text, cursor: "pointer" };
const checkboxLabelLocked = { opacity: 0.65, cursor: "not-allowed" };
const checkboxInput = { width: 18, height: 18, accentColor: theme.primary };
const checkboxText = {};
const lockedBadge = { fontSize: 11, color: theme.textMuted, fontWeight: 500 };

const ousersWrap = {
  display: "flex",
  flexDirection: "column",
  gap: 24,
  border: `1px solid ${theme.border}`,
  borderRadius: theme.borderRadius,
  background: theme.surface,
  padding: 28,
  boxShadow: theme.shadow,
};
const ousersHeader = {
  display: "flex",
  alignItems: "center",
  gap: 14,
  flexWrap: "wrap",
};
const ousersHeaderIconWrap = {
  width: 44,
  height: 44,
  borderRadius: "50%",
  background: theme.surfaceAlt,
  border: `1px solid ${theme.border}`,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: theme.primary,
};
const ousersTitle = { fontSize: 22, fontWeight: 900, color: theme.text, margin: 0 };
const ousersSubtitle = { fontSize: 14, color: theme.textMuted, margin: "4px 0 0 0", lineHeight: 1.4 };
const ousersTopRow = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 24,
};
const ousersSummaryCards = { display: "flex", gap: 16, flexWrap: "wrap" };
const ousersSummaryCard = {
  flex: "1 1 140px",
  padding: 20,
  borderRadius: theme.borderRadius,
  background: theme.surfaceAlt,
  border: `1px solid ${theme.border}`,
  display: "flex",
  flexDirection: "column",
  gap: 6,
  boxShadow: theme.shadowMd,
};
const ousersSummaryIcon = { color: theme.textMuted, alignSelf: "flex-start" };
const ousersSummaryLabel = { fontSize: 13, fontWeight: 700, color: theme.textMuted };
const ousersSummaryValue = { fontSize: 24, fontWeight: 900, color: theme.text };
const ousersSummaryMeta = { fontSize: 12, color: theme.textMuted };
const ousersUserCard = {
  padding: 20,
  borderRadius: theme.borderRadius,
  background: theme.surfaceAlt,
  border: `1px solid ${theme.border}`,
  display: "flex",
  flexDirection: "column",
  gap: 14,
  boxShadow: theme.shadowMd,
};
const ousersUserCardHeader = { display: "flex", alignItems: "center", gap: 12 };
const ousersUserCardIcon = { color: theme.primary };
const ousersUserCardTitle = { fontSize: 16, fontWeight: 800, color: theme.text };
const ousersUserCardSubtitle = { fontSize: 13, color: theme.textMuted };
const ousersSelect = {
  ...input,
  maxWidth: "100%",
};
const ousersInfoBanner = {
  display: "flex",
  alignItems: "flex-start",
  gap: 14,
  padding: 16,
  borderRadius: theme.borderRadiusSm,
  background: "#fef9c3",
  border: `1px solid ${theme.warning}`,
};
const ousersInfoIcon = { color: "#b45309", flexShrink: 0, marginTop: 2 };
const ousersInfoText = { fontSize: 14, color: "#92400e", margin: 0, lineHeight: 1.6, flex: 1 };
const ousersPermsSection = {
  padding: 24,
  borderRadius: theme.borderRadius,
  background: theme.surfaceAlt,
  border: `1px solid ${theme.border}`,
  display: "flex",
  flexDirection: "column",
  gap: 20,
  boxShadow: theme.shadowMd,
};
const ousersPermsTitle = { fontSize: 18, fontWeight: 900, color: theme.text, margin: 0 };
const ousersPermsGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
  gap: 12,
};
const ousersPermRow = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "12px 16px",
  borderRadius: theme.borderRadiusSm,
  border: `1px solid ${theme.border}`,
  background: theme.surface,
};
const ousersPermLabel = { fontSize: 14, fontWeight: 700, color: theme.text };
const ousersPermLockedBadge = {
  color: theme.textMuted,
  display: "flex",
  alignItems: "center",
};
const ousersPermSelect = {
  ...input,
  minWidth: 120,
  padding: "8px 12px",
  fontSize: 13,
  cursor: "pointer",
};
const ousersSaveRow = { display: "flex", width: "100%", marginTop: 8 };
const ousersSaveBtn = {
  ...btnPrimary,
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 12,
  padding: "14px 20px",
};
