// src/contexts/AuthContext.jsx
// Login via backend only (VITE_API_URL). Plan, limits, subscription from DB (GET /api/auth/me).
// Session persisted in localStorage so user can open the app directly when returning.
import React, { createContext, useCallback, useContext, useMemo, useState, useEffect } from "react";
import { isApiMode, apiLogin, apiMe } from "../lib/api.js";
import { getEnabledModulesForPlan } from "../lib/plans.js";

const AUTH_STORAGE_KEY = "al_salam_auth";

function readStoredAuth() {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(AUTH_STORAGE_KEY) : null;
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data && typeof data.token === "string") return { token: data.token, user: data.user || null };
  } catch {}
  return null;
}

function writeStoredAuth(token, user) {
  try {
    if (typeof localStorage !== "undefined") {
      if (token) localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ token, user: user || null }));
      else localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  } catch {}
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [token, setToken] = useState(null);
  const [me, setMe] = useState(null); // { plan, limits, usage, allowedModules, role, subscription }
  const [isReady, setIsReady] = useState(!isApiMode());
  const [loggingOut, setLoggingOut] = useState(false);
  const [subscriptionExpiredPayload, setSubscriptionExpiredPayload] = useState(null);

  // Restore session from localStorage on mount (API mode only).
  useEffect(() => {
    if (!isApiMode()) {
      setIsReady(true);
      return;
    }
    const stored = readStoredAuth();
    if (!stored?.token) {
      setIsReady(true);
      return;
    }
    apiMe(stored.token)
      .then((meRes) => {
        if (!meRes.ok) {
          writeStoredAuth(null);
          setToken(null);
          setCurrentUser(null);
          setMe(null);
          if (meRes.code === "subscription_expired" && (meRes.user || meRes.subscription)) {
            setSubscriptionExpiredPayload({
              user: meRes.user,
              org: meRes.org,
              subscription: meRes.subscription,
            });
          }
          setIsReady(true);
          return;
        }
        setToken(stored.token);
        setCurrentUser(meRes.user || stored.user || null);
        setMe({
          plan: meRes.subscription?.plan || "basic",
          limits: meRes.limits,
          usage: meRes.usage || {},
          allowedModules: meRes.allowedModules || [],
          modulePermissions: meRes.modulePermissions || null,
          role: meRes.role,
          subscription: meRes.subscription,
          org: meRes.org,
          oadminUsername: meRes.oadminUsername ?? null,
        });
        setIsReady(true);
      })
      .catch(() => {
        writeStoredAuth(null);
        setIsReady(true);
      });
  }, []);

  const clearSubscriptionExpiredPayload = useCallback(() => setSubscriptionExpiredPayload(null), []);

  const login = useCallback(async (username, password) => {
    const u = String(username ?? "").trim();
    const p = String(password ?? "");

    if (!isApiMode()) {
      return {
        ok: false,
        error: "لا يوجد اتصال بالخادم. شغّل الخادم من مجلد server (npm start) ثم حدّث الصفحة. للتطوير يمكن استخدام ملف .env.development وضبط VITE_API_URL فيه (مثال: http://localhost:3000).",
      };
    }

    const res = await apiLogin(u, p);
    if (!res.ok) {
      const isExpired =
        res.code === "subscription_expired" ||
        res.status === 403 ||
        (res.user != null || res.subscription != null);
      if (isExpired) {
        return {
          ok: false,
          error: res.error,
          code: "subscription_expired",
          status: res.status,
          subscriptionExpired: {
            user: res.user ?? null,
            org: res.org ?? null,
            subscription: res.subscription ?? null,
          },
        };
      }
      return { ok: false, error: res.error, status: res.status };
    }
    setToken(res.token);
    setCurrentUser(res.user);
    writeStoredAuth(res.token, res.user);
    const meRes = await apiMe(res.token);
    if (!meRes.ok) {
      setToken(null);
      setCurrentUser(null);
      writeStoredAuth(null);
      if (meRes.code === "subscription_expired") {
        return {
          ok: false,
          error: meRes.error || "فشل جلب بيانات الاشتراك.",
          code: "subscription_expired",
          subscriptionExpired: { user: meRes.user, org: meRes.org, subscription: meRes.subscription },
        };
      }
      return { ok: false, error: meRes.error || "فشل جلب بيانات الاشتراك." };
    }
    setMe({
      plan: meRes.subscription?.plan || "basic",
      limits: meRes.limits,
      usage: meRes.usage || {},
      allowedModules: meRes.allowedModules || [],
      modulePermissions: meRes.modulePermissions || null,
      role: meRes.role,
      subscription: meRes.subscription,
      org: meRes.org,
      oadminUsername: meRes.oadminUsername ?? null,
    });
    return { ok: true };
  }, []);

  const logout = useCallback(() => {
    setLoggingOut(true);
  }, []);

  // After showing splash, clear auth and go to login
  useEffect(() => {
    if (!loggingOut) return;
    const t = setTimeout(() => {
      writeStoredAuth(null);
      setCurrentUser(null);
      setToken(null);
      setMe(null);
      setLoggingOut(false);
    }, 700);
    return () => clearTimeout(t);
  }, [loggingOut]);

  /** Update current user (e.g. after username change from profile). */
  const updateUser = useCallback((updatedUser) => {
    if (updatedUser && typeof updatedUser === "object") {
      setCurrentUser((prev) => (prev ? { ...prev, ...updatedUser } : updatedUser));
    }
  }, []);

  const createAccount = useCallback(async () => {
    return { ok: false, error: "إنشاء الحساب يتم من خلال الخادم (API) أو أداة سطر الأوامر create-user." };
  }, []);

  const plan = me?.plan ?? "pro";
  const limits = me?.limits ?? null;
  const usage = me?.usage ?? {};
  const subscription = me?.subscription ?? null;
  const isSubscriptionExpired = useMemo(() => {
    if (!subscription || subscription.status !== "active") return true;
    const endsAt = subscription.endsAt ?? subscription.ends_at;
    if (endsAt == null) return false;
    const endsAtMs = new Date(endsAt).getTime();
    return Number.isFinite(endsAtMs) && endsAtMs <= Date.now();
  }, [subscription]);

  // When me says subscription is expired (e.g. time passed), clear session and set payload so AuthGate shows Subscription Expired
  useEffect(() => {
    if (!isSubscriptionExpired || !me || !currentUser) return;
    writeStoredAuth(null);
    setToken(null);
    setCurrentUser(null);
    setMe(null);
    setSubscriptionExpiredPayload({
      user: currentUser,
      org: me?.org ?? null,
      subscription: me?.subscription ?? null,
    });
  }, [isSubscriptionExpired, me, currentUser]);

  // Hourly subscription check: if expired, clear session and set payload so AuthGate redirects to Subscription Expired
  useEffect(() => {
    if (!isApiMode() || !token || !currentUser) return;
    const interval = setInterval(() => {
      apiMe(token).then((meRes) => {
        if (!meRes.ok && meRes.code === "subscription_expired" && (meRes.user || meRes.subscription)) {
          writeStoredAuth(null);
          setToken(null);
          setCurrentUser(null);
          setMe(null);
          setSubscriptionExpiredPayload({
            user: meRes.user ?? null,
            org: meRes.org ?? null,
            subscription: meRes.subscription ?? null,
          });
        }
      });
    }, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [token, currentUser]);

  // When me is not loaded yet (e.g. token just set before apiMe returns), use empty list so we don't call plan-restricted APIs (avoids 403).
  // Once me is set, use server allowedModules or derive from plan.
  const allowedModules =
    me == null
      ? []
      : Array.isArray(me.allowedModules) && me.allowedModules.length > 0
        ? me.allowedModules
        : getEnabledModulesForPlan(plan);

  const role = me?.role ?? "oadmin";
  const effectiveModulePermissions =
    me?.modulePermissions && Object.keys(me.modulePermissions).length > 0
      ? me.modulePermissions
      : role === "oadmin"
        ? Object.fromEntries((Array.isArray(allowedModules) ? allowedModules : []).map((k) => [k, "read_write"]))
        : null;

  const canAccess = useCallback(
    (moduleKey) => {
      if (!moduleKey) return true;
      return Array.isArray(allowedModules) ? allowedModules.includes(moduleKey) : allowedModules?.has?.(moduleKey);
    },
    [allowedModules]
  );

  const canWrite = useCallback(
    (moduleKey) => {
      if (!moduleKey) return true;
      const perm = effectiveModulePermissions?.[moduleKey];
      return perm === "read_write";
    },
    [effectiveModulePermissions]
  );

  const isAtLimit = useCallback(
    (usageKey, limitKey) => {
      if (!limits || limits[limitKey] == null) return false;
      const current = usage[usageKey] ?? 0;
      return current >= limits[limitKey];
    },
    [limits, usage]
  );

  const getLimit = useCallback(
    (limitKey) => {
      if (!limits) return null;
      const v = limits[limitKey];
      return v == null ? null : Number(v);
    },
    [limits]
  );

  const value = useMemo(
    () => ({
      user: currentUser,
      token,
      isReady,
      isLoggedIn: !!currentUser,
      hasAnyUser: true,
      loggingOut,
      login,
      logout,
      updateUser,
      createAccount,
      plan,
      limits,
      usage,
      allowedModules,
      modulePermissions: effectiveModulePermissions,
      role: me?.role ?? "oadmin",
      subscription: me?.subscription,
      org: me?.org,
      oadminUsername: me?.oadminUsername ?? null,
      canAccess,
      canWrite,
      isAtLimit,
      getLimit,
      isApiMode: isApiMode(),
      subscriptionExpiredPayload,
      clearSubscriptionExpiredPayload,
      isSubscriptionExpired,
    }),
    [
      currentUser,
      token,
      loggingOut,
      login,
      logout,
      updateUser,
      createAccount,
      plan,
      limits,
      usage,
      allowedModules,
      effectiveModulePermissions,
      me?.role,
      me?.subscription,
      me?.org,
      me?.oadminUsername,
      canAccess,
      canWrite,
      isAtLimit,
      getLimit,
      subscriptionExpiredPayload,
      clearSubscriptionExpiredPayload,
      isSubscriptionExpired,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider.");
  return ctx;
}
