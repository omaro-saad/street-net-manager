// src/App.jsx
import { useEffect, useRef, useState } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import BottomNav from "./components/BottomNav";
import SplashScreen from "./components/SplashScreen";
import { ROUTES } from "./config/routes";

import HomePage from "./pages/HomePage";
import SubscribersPage from "./pages/SubscribersPage";
import DistributorsPage from "./pages/DistributorsPage";
import PlansPage from "./pages/PlansPage";
import DevicesPage from "./pages/DevicesPage";
import FinancePage from "./pages/FinancePage";
import SettingsPage from "./pages/SettingsPage";
import EmployeesPage from "./pages/EmployeesPage";
import MyMapPage from "./pages/MyMapPage";
import PackagesPage from "./pages/PackagesPage";
import ActivationPage from "./pages/ActivationPage";

function TrialLimitOverlay({ payload, onClose, onActivate }) {
  if (!payload) return null;

  const entityMap = {
    subscribers: "المشتركين",
    distributors: "الموزعين",
    lines: "الخطوط",
    packages: "الحزم",
    employees: "الموظفين",
    warehouse: "المخزن",
  };

  const entityLabel = entityMap[payload.entity] || payload.entity || "البيانات";
  const limit = payload.limit ?? 1;
  const target = payload.target ? ` (نوع: ${payload.target})` : "";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 999999,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 18,
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        style={{
          width: "min(560px, 96vw)",
          background: "#fff",
          borderRadius: 20,
          padding: 18,
          boxShadow: "0 18px 60px rgba(0,0,0,0.35)",
          direction: "rtl",
          textAlign: "right",
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 8 }}>هذه نسخة تجريبية فقط</div>

        <div style={{ fontSize: 14, lineHeight: 1.7, color: "#111827" }}>
          وصلت للحد الأقصى في <b>{entityLabel}</b>
          {target} — الحد الحالي: <b>{limit}</b>
          <br />
          <span style={{ color: "#374151" }}>
            عند التحديث للنسخة الكاملة ستُفتح الحدود وتبقى بياناتك كما هي بدون حذف.
          </span>
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-start", marginTop: 14 }}>
          <button
            onClick={onActivate}
            style={{
              border: "none",
              background: "#2563EB",
              color: "#fff",
              padding: "10px 14px",
              borderRadius: 12,
              cursor: "pointer",
              fontWeight: 800,
            }}
          >
            تفعيل النسخة الكاملة
          </button>

          <button
            onClick={onClose}
            style={{
              border: "none",
              background: "#111827",
              color: "#fff",
              padding: "10px 14px",
              borderRadius: 12,
              cursor: "pointer",
              fontWeight: 800,
            }}
          >
            تمام
          </button>
        </div>

        <div style={{ marginTop: 10, fontSize: 12, color: "#6B7280" }}>(التفعيل اختياري — التطبيق شغال كتجربة مع حدود)</div>
      </div>
    </div>
  );
}

function AppInner() {
  const navigate = useNavigate();
  const location = useLocation();

  const [showSplash, setShowSplash] = useState(true);

  // ✅ Boot license check state
  const [bootChecking, setBootChecking] = useState(true);
  const [isActivated, setIsActivated] = useState(false);

  const [trialPayload, setTrialPayload] = useState(null);

  // ✅ آخر صفحة حاول المستخدم يدخلها قبل ما نحوله على /activate
  const lastWantedPathRef = useRef("/");

  useEffect(() => {
    const t = setTimeout(() => setShowSplash(false), 900);
    return () => clearTimeout(t);
  }, []);

  // ✅ Trial overlay listener
  useEffect(() => {
    const api = window?.api;
    if (!api?.trial?.onLimit) return;

    const off = api.trial.onLimit((payload) => {
      setTrialPayload(payload || { entity: "unknown", limit: 1 });
    });

    return () => {
      try {
        if (typeof off === "function") off();
      } catch {}
    };
  }, []);

  // ✅ helper: redirect logic
  const goToActivation = (replace = true) => {
    // خزّن آخر مكان (لو مش /activate)
    if (location.pathname && location.pathname !== ROUTES.ACTIVATE) {
      lastWantedPathRef.current = location.pathname;
    }
    navigate(ROUTES.ACTIVATE, { replace });
  };

  const goToAppAfterActivation = () => {
    const target = lastWantedPathRef.current || "/";
    // لو target هو /activate بالغلط، ارجع للـ home
    const safeTarget = target === ROUTES.ACTIVATE ? ROUTES.HOME : target;
    navigate(safeTarget, { replace: true });
  };

  // ✅ Check activation ONCE at boot (after splash)
  useEffect(() => {
    if (showSplash) return;

    let alive = true;

    (async () => {
      try {
        const api = window?.api;

        if (!api?.license?.check) {
          // Web/dev بدون Electron
          if (!alive) return;
          setIsActivated(true);
          setBootChecking(false);
          return;
        }

        const res = await api.license.check();
        if (!alive) return;

        const ok = !!res?.ok;
        setIsActivated(ok);
        setBootChecking(false);

        if (!ok) {
          goToActivation(true);
        } else {
          // لو كان واقف على /activate (مثلاً بعد Restart) رجعه للتطبيق
          if (location.pathname === ROUTES.ACTIVATE) goToAppAfterActivation();
        }
      } catch {
        if (!alive) return;
        setIsActivated(false);
        setBootChecking(false);
        goToActivation(true);
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSplash]);

  // ✅ Listen to license changes (activate/deactivate) بدون refresh
  useEffect(() => {
    const api = window?.api;
    const onChanged = api?.license?.onChanged;
    if (!onChanged) return;

    const off = onChanged(async (_payload) => {
      try {
        const res = await api.license.check();
        const ok = !!res?.ok;
        setIsActivated(ok);

        if (ok) {
          // ✅ أهم سطر: بعد التفعيل رجّعه للتطبيق
          if (location.pathname === ROUTES.ACTIVATE) goToAppAfterActivation();
        } else {
          goToActivation(true);
        }
      } catch {
        setIsActivated(false);
        goToActivation(true);
      }
    });

    return () => {
      try {
        if (typeof off === "function") off();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  if (showSplash) return <SplashScreen />;

  if (bootChecking) {
    return <SplashScreen />;
  }

  // ✅ Activation page full-screen mode
  const forceActivation = !isActivated;
  if (forceActivation) {
    return (
      <div style={{ minHeight: "100vh" }}>
        <Routes>
          <Route path={ROUTES.ACTIVATE} element={<ActivationPage />} />
          <Route path="*" element={<ActivationPage />} />
        </Routes>
      </div>
    );
  }

  // ✅ Normal app shell
  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#f3f4f6",
        color: "#111827",
        paddingBottom: "80px",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: 28,
          WebkitAppRegion: "drag",
          zIndex: 9999,
          background: "transparent",
        }}
      />

      <div
        style={{
          width: "90%",
          height: "calc(100vh - 160px)",
          backgroundColor: "#ffffff",
          borderRadius: "26px",
          padding: "24px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
        }}
      >
        <Routes>
          <Route path={ROUTES.HOME} element={<HomePage />} />
          <Route path={ROUTES.SUBSCRIBERS} element={<SubscribersPage />} />
          <Route path={ROUTES.DISTRIBUTORS} element={<DistributorsPage />} />
          <Route path={ROUTES.PLANS} element={<PlansPage />} />
          <Route path={ROUTES.MAP} element={<MyMapPage />} />
          <Route path={ROUTES.PACKAGES} element={<PackagesPage />} />
          <Route path={ROUTES.DEVICES} element={<DevicesPage />} />
          <Route path={ROUTES.EMPLOYEE} element={<EmployeesPage />} />
          <Route path={ROUTES.FINANCE} element={<FinancePage />} />
          <Route path={ROUTES.SETTINGS} element={<SettingsPage />} />
          <Route path={ROUTES.ACTIVATE} element={<ActivationPage />} />
        </Routes>
      </div>

      <BottomNav />

      <TrialLimitOverlay
        payload={trialPayload}
        onClose={() => setTrialPayload(null)}
        onActivate={() => {
          setTrialPayload(null);
          navigate(ROUTES.ACTIVATE);
        }}
      />
    </div>
  );
}

export default function App() {
  return <AppInner />;
}
