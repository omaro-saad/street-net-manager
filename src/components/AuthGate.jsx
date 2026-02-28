// src/components/AuthGate.jsx
// Single source for "subscription expired": only when backend returns code "subscription_expired" (login, /me, or any API).
// subscriptionExpiredPayload is set only in that case; we never treat other 403 as expired. Expired users cannot login or use the app.
import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useData } from "../DataContext";
import { ROUTES } from "../config/routes.js";
import SplashScreen from "./SplashScreen";
import LoginPage from "../pages/LoginPage";
import SubscriptionExpiredPage from "../pages/SubscriptionExpiredPage";

const SUBSCRIPTION_EXPIRED_FLAG = "subscription_expired_shown";

function isPathSubscriptionExpired(pathname) {
  const p = (pathname || "").replace(/\/$/, "");
  return p === ROUTES.SUBSCRIPTION_EXPIRED || p === "subscription-expired";
}

export default function AuthGate({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname || "";
  const { isReady, isLoggedIn, loggingOut, subscriptionExpiredPayload, clearSubscriptionExpiredPayload, isSubscriptionExpired, revalidateSession } = useAuth();
  const { initDone } = useData();
  const [recheckDone, setRecheckDone] = useState(false);
  const expiredFlagSet = (() => {
    try {
      return sessionStorage.getItem(SUBSCRIPTION_EXPIRED_FLAG) === "1";
    } catch {
      return false;
    }
  })();

  // When backend says subscription expired → redirect to dedicated page and set flag so user cannot navigate away except to login
  useEffect(() => {
    if (!subscriptionExpiredPayload) return;
    try {
      sessionStorage.setItem(SUBSCRIPTION_EXPIRED_FLAG, "1");
    } catch {}
    navigate(ROUTES.SUBSCRIPTION_EXPIRED, { state: { subscriptionExpired: subscriptionExpiredPayload }, replace: true });
    clearSubscriptionExpiredPayload();
  }, [subscriptionExpiredPayload, navigate, clearSubscriptionExpiredPayload]);

  // Before showing the app: revalidate session (refresh / open / any loading). Block with Splash until /me returns; if 403 → kick to Subscription Expired.
  useEffect(() => {
    if (!isLoggedIn || !initDone) {
      setRecheckDone(false);
      return;
    }
    if (recheckDone) return;
    revalidateSession().then(() => setRecheckDone(true));
  }, [isLoggedIn, initDone, recheckDone, revalidateSession]);

  // When not logged in and subscription-expired flag is set, redirect to Subscription Expired (except on Login). Do in effect to avoid setState during render.
  useEffect(() => {
    if (isLoggedIn) return;
    try {
      if (sessionStorage.getItem(SUBSCRIPTION_EXPIRED_FLAG) === "1" && pathname !== ROUTES.LOGIN && !isPathSubscriptionExpired(pathname)) {
        navigate(ROUTES.SUBSCRIPTION_EXPIRED, { replace: true });
      }
    } catch {}
  }, [isLoggedIn, pathname, navigate]);

  // Not ready or logging out
  if (!isReady) return <SplashScreen />;
  if (loggingOut) return <SplashScreen />;

  // Hard guard: URL is /subscription-expired → never render the app, always show only SubscriptionExpiredPage (stops automatic redirect to app).
  if (isPathSubscriptionExpired(pathname)) {
    try {
      sessionStorage.setItem(SUBSCRIPTION_EXPIRED_FLAG, "1");
    } catch {}
    return <SubscriptionExpiredPage payload={subscriptionExpiredPayload} />;
  }

  // Expired: always show only SubscriptionExpiredPage (no Splash, no other view). Effect below will set flag and sync URL.
  if (subscriptionExpiredPayload) {
    return <SubscriptionExpiredPage payload={subscriptionExpiredPayload} />;
  }

  // When expired flag is set, never render the app — only Subscription Expired or Login. Prevents any automatic redirect into the app.
  if (expiredFlagSet) {
    if (pathname === ROUTES.LOGIN) return <LoginPage />;
    return <SplashScreen />;
  }

  // Logged in but subscription expired (e.g. from hourly check or visibility) → only Subscription Expired page
  if (isLoggedIn && isSubscriptionExpired) {
    try {
      sessionStorage.setItem(SUBSCRIPTION_EXPIRED_FLAG, "1");
    } catch {}
    return <SubscriptionExpiredPage />;
  }

  // Not logged in: show Login
  if (!isLoggedIn) return <LoginPage />;

  // Keep splash visible until global initialization (all required data) is complete
  if (!initDone) return <SplashScreen />;

  // One more gate: revalidate session before showing app (manual refresh, open app, any loading). Expired → revalidateSession sets payload and we'll show Expired on next render.
  if (!recheckDone) return <SplashScreen />;

  return children;
}
