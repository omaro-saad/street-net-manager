// src/components/AuthGate.jsx
// If no user (not logged in) → show LoginPage or SubscriptionExpiredPage. If logged in and subscription expired → force Subscription Expired. If logged in and valid → app.
import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useData } from "../DataContext";
import { ROUTES } from "../config/routes.js";
import SplashScreen from "./SplashScreen";
import LoginPage from "../pages/LoginPage";
import SubscriptionExpiredPage from "../pages/SubscriptionExpiredPage";

const SUBSCRIPTION_EXPIRED_FLAG = "subscription_expired_shown";

export default function AuthGate({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isReady, isLoggedIn, loggingOut, subscriptionExpiredPayload, clearSubscriptionExpiredPayload, isSubscriptionExpired } = useAuth();
  const { initDone } = useData();

  // When backend says subscription expired → redirect to dedicated page and set flag so user cannot navigate away except to login
  useEffect(() => {
    if (!subscriptionExpiredPayload) return;
    try {
      sessionStorage.setItem(SUBSCRIPTION_EXPIRED_FLAG, "1");
    } catch {}
    navigate(ROUTES.SUBSCRIPTION_EXPIRED, { state: { subscriptionExpired: subscriptionExpiredPayload }, replace: true });
    clearSubscriptionExpiredPayload();
  }, [subscriptionExpiredPayload, navigate, clearSubscriptionExpiredPayload]);

  // Not ready or logging out
  if (!isReady) return <SplashScreen />;
  if (loggingOut) return <SplashScreen />;
  if (subscriptionExpiredPayload) return <SplashScreen />;

  // Logged in but subscription expired (e.g. from hourly check) → force Subscription Expired page
  if (isLoggedIn && isSubscriptionExpired) {
    try {
      sessionStorage.setItem(SUBSCRIPTION_EXPIRED_FLAG, "1");
    } catch {}
    return <SubscriptionExpiredPage />;
  }

  // Not logged in
  if (!isLoggedIn) {
    if (location.pathname === ROUTES.SUBSCRIPTION_EXPIRED) return <SubscriptionExpiredPage />;
    // If subscription-expired flag is set, only allow Login page. Any other URL → force back to Subscription Expired.
    try {
      if (sessionStorage.getItem(SUBSCRIPTION_EXPIRED_FLAG) === "1" && location.pathname !== ROUTES.LOGIN) {
        navigate(ROUTES.SUBSCRIPTION_EXPIRED, { replace: true });
        return <SplashScreen />;
      }
    } catch {}
    return <LoginPage />;
  }

  // Keep splash visible until global initialization (all required data) is complete
  if (!initDone) return <SplashScreen />;

  return children;
}
