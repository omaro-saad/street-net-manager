// src/pages/LoginPage.jsx
// Shown when no user is logged in. First-time: create account. Otherwise: login.
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import SplashScreen from "../components/SplashScreen";
import { ROUTES } from "../config/routes.js";
import { theme } from "../theme.js";
import { input, btnPrimary, miniLabel, h1, textMuted } from "../styles/shared.js";

export default function LoginPage() {
  const navigate = useNavigate();
  const { hasAnyUser, login, createAccount } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Apply saved theme on login page so it matches app (no DataContext yet)
  useEffect(() => {
    const saved = typeof localStorage !== "undefined" ? localStorage.getItem("app_theme") : null;
    const isDark = saved === "dark";
    const root = document.documentElement;
    if (isDark) root.classList.add("theme-dark");
    else root.classList.remove("theme-dark");
  }, []);

  const isCreateMode = !hasAnyUser;
  const title = isCreateMode ? "إنشاء حساب" : "تسجيل الدخول";
  const submitLabel = isCreateMode ? "إنشاء الحساب والدخول" : "دخول";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const fn = isCreateMode ? createAccount : login;
      const res = await fn(username, password);
      if (res?.ok) {
        navigate(ROUTES.HOME, { replace: true });
        return;
      }
      if (res?.status === 403 || res?.code === "subscription_expired" || res?.subscriptionExpired) {
        const payload = res?.subscriptionExpired ?? {
          user: res?.user ?? null,
          org: res?.org ?? null,
          subscription: res?.subscription ?? null,
        };
        navigate(ROUTES.SUBSCRIPTION_EXPIRED, { state: { subscriptionExpired: payload }, replace: true });
        return;
      }
      setError(res?.error || "حدث خطأ.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <SplashScreen />;
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: `linear-gradient(160deg, ${theme.bg} 0%, ${theme.surface} 50%)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        direction: "rtl",
        textAlign: "right",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 400,
          background: theme.surface,
          borderRadius: 24,
          boxShadow: "0 20px 60px rgba(0,0,0,0.12)",
          padding: 32,
          border: `1px solid ${theme.border}`,
        }}
      >
        <h1 style={{ ...h1, marginBottom: 8 }}>{title}</h1>
        <p style={{ ...textMuted, marginBottom: 24 }}>
          {isCreateMode
            ? "لا يوجد مستخدمين بعد. أنشئ حسابك لبدء استخدام التطبيق."
            : "أدخل بياناتك للدخول."}
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <label style={miniLabel}>اسم المستخدم</label>
            <input
              type="text"
              autoComplete="username"
              style={{...input, color: theme.text}}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="أدخل اسم المستخدم"
              disabled={loading}
            />
          </div>
          <div>
            <label style={miniLabel}>كلمة المرور</label>
            <input
              type="password"
              autoComplete={isCreateMode ? "new-password" : "current-password"}
              style={{...input, color: theme.text}}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="أدخل كلمة المرور"
              disabled={loading}
            />
          </div>

          {error ? (
            <div
              style={{
                fontSize: 13,
                color: theme.error,
                fontWeight: 700,
                padding: "8px 12px",
                background: theme.surfaceAlt,
                borderRadius: 12,
                border: `1px solid ${theme.error}`,
              }}
            >
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            style={{
              ...btnPrimary,
              width: "100%",
              padding: "14px 16px",
              fontSize: 15,
            }}
            disabled={loading || !username.trim() || !password}
          >
            {loading ? "جاري التنفيذ..." : submitLabel}
          </button>
        </form>
      </div>
    </div>
  );
}
