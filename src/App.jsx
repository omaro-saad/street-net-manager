// src/App.jsx
import { Suspense, lazy, useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import BottomNav from "./components/BottomNav";
import LoadingLogo from "./components/LoadingLogo";
import AuthGate from "./components/AuthGate";
import PlanGate from "./components/PlanGate";
import { ROUTES } from "./config/routes";
import { useData } from "./DataContext.jsx";

import HomePage from "./pages/HomePage";
import SettingsPage from "./pages/SettingsPage";
import SubscriptionExpiredPage from "./pages/SubscriptionExpiredPage";

const SubscribersPage = lazy(() => import("./pages/SubscribersPage"));
const DistributorsPage = lazy(() => import("./pages/DistributorsPage"));
const LinesPage = lazy(() => import("./pages/LinesPage"));
const DevicesPage = lazy(() => import("./pages/DevicesPage"));
const FinancePage = lazy(() => import("./pages/FinancePage"));
const EmployeesPage = lazy(() => import("./pages/EmployeesPage"));
const MyMapPage = lazy(() => import("./pages/MyMapPage"));
const PackagesPage = lazy(() => import("./pages/PackagesPage"));

function PageFallback() {
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "40vh", width: "100%" }}>
      <LoadingLogo />
    </div>
  );
}

function AppInner() {
  const { data } = useData();
  const appTheme = data?.settings?.admin?.theme || (typeof localStorage !== "undefined" ? localStorage.getItem("app_theme") : null) || "light";
  const isDark = appTheme === "dark";

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add("theme-dark");
    } else {
      root.classList.remove("theme-dark");
    }
    if (typeof localStorage !== "undefined") localStorage.setItem("app_theme", appTheme);
  }, [appTheme, isDark]);

  return (
    <AuthGate>
    <div
      className={isDark ? "app-wrap theme-dark" : "app-wrap"}
      style={{
        minHeight: "100vh",
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
        className="app-inner"
        style={{
          width: "90%",
          height: "calc(100vh - 160px)",
          borderRadius: "26px",
          padding: "24px",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
        }}
      >
        <Routes>
          <Route path={ROUTES.SUBSCRIPTION_EXPIRED} element={<SubscriptionExpiredPage />} />
          <Route path={ROUTES.HOME} element={<HomePage />} />
          <Route path={ROUTES.SUBSCRIBERS} element={<PlanGate moduleKey="subscribers"><Suspense fallback={<PageFallback />}><SubscribersPage /></Suspense></PlanGate>} />
          <Route path={ROUTES.DISTRIBUTORS} element={<PlanGate moduleKey="distributors"><Suspense fallback={<PageFallback />}><DistributorsPage /></Suspense></PlanGate>} />
          <Route path={ROUTES.LINES} element={<PlanGate moduleKey="lines"><Suspense fallback={<PageFallback />}><LinesPage /></Suspense></PlanGate>} />
          <Route path={ROUTES.MAP} element={<PlanGate moduleKey="map"><Suspense fallback={<PageFallback />}><MyMapPage /></Suspense></PlanGate>} />
          <Route path={ROUTES.PACKAGES} element={<PlanGate moduleKey="packages"><Suspense fallback={<PageFallback />}><PackagesPage /></Suspense></PlanGate>} />
          <Route path={ROUTES.DEVICES} element={<PlanGate moduleKey="devices"><Suspense fallback={<PageFallback />}><DevicesPage /></Suspense></PlanGate>} />
          <Route path={ROUTES.EMPLOYEE} element={<PlanGate moduleKey="employee"><Suspense fallback={<PageFallback />}><EmployeesPage /></Suspense></PlanGate>} />
          <Route path={ROUTES.FINANCE} element={<PlanGate moduleKey="finance"><Suspense fallback={<PageFallback />}><FinancePage /></Suspense></PlanGate>} />
          <Route path={ROUTES.SETTINGS} element={<PlanGate moduleKey="settings"><SettingsPage /></PlanGate>} />
        </Routes>
      </div>

      <BottomNav />
    </div>
    </AuthGate>
  );
}

export default function App() {
  return <AppInner />;
}
