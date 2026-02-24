// src/components/AuthGate.jsx
// If no user (not logged in) → show LoginPage or SubscriptionExpiredPage (when URL is /subscription-expired). If logged in → show SplashScreen until app init completes, then app.
import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useData } from "../DataContext";
import { ROUTES } from "../config/routes.js";
import SplashScreen from "./SplashScreen";
import LoginPage from "../pages/LoginPage";
import SubscriptionExpiredPage from "../pages/SubscriptionExpiredPage";

export default function AuthGate({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isReady, isLoggedIn, loggingOut, subscriptionExpiredPayload, clearSubscriptionExpiredPayload } = useAuth();
  const { initDone } = useData();

  useEffect(() => {
    if (!subscriptionExpiredPayload) return;
    navigate(ROUTES.SUBSCRIPTION_EXPIRED, { state: { subscriptionExpired: subscriptionExpiredPayload }, replace: true });
    clearSubscriptionExpiredPayload();
  }, [subscriptionExpiredPayload, navigate, clearSubscriptionExpiredPayload]);

  if (!isReady) return <SplashScreen />;
  if (loggingOut) return <SplashScreen />;
  if (subscriptionExpiredPayload) return <SplashScreen />;
  if (!isLoggedIn) {
    if (location.pathname === ROUTES.SUBSCRIPTION_EXPIRED) return <SubscriptionExpiredPage />;
    return <LoginPage />;
  }
  // Keep splash visible until global initialization (all required data) is complete
  if (!initDone) return <SplashScreen />;

  return children;
}
