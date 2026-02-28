/**
 * JWT auth + plan/subscription resolution.
 * Uses DB accounts when SUPABASE_URL is set, else in-memory.
 * Expired subscriptions are rejected (403 subscription_expired).
 */
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { accounts } from "../db/accounts-loader.js";
import { getLimit, getEnabledModulesForPlan, isModuleEnabled, PLANS } from "../config/plans.js";
import { isSubscriptionExpired } from "../lib/subscription.js";

const UPGRADE_MSG = "لقد وصلت لحد الخطة. يرجى الترقية.";

export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ ok: false, error: "مطلوب تسجيل الدخول." });
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    const user = await accounts.findUserById(decoded.userId);
    if (!user) {
      return res.status(401).json({ ok: false, error: "انتهت الجلسة أو الرمز غير صالح." });
    }
    req.user = {
      id: user.id,
      username: user.username,
      orgId: user.orgId,
      role: user.role,
      displayName: user.displayName,
      addonEmployeePermissions: user.addonEmployeePermissions,
      publicId: user.publicId ?? null,
    };
    req.orgId = user.orgId;
    req.role = user.role;
    next();
  } catch {
    return res.status(401).json({ ok: false, error: "انتهت الجلسة أو الرمز غير صالح." });
  }
}

/**
 * Resolve subscription, plan, limits, and (for employee) allowed modules.
 * Call after requireAuth.
 */
export async function requirePlan(req, res, next) {
  const org = await accounts.getOrgById(req.orgId);
  const sub = await (accounts.getSubscriptionAnyStatus?.(req.orgId) ?? accounts.getSubscription(req.orgId));
  if (!org || !sub) {
    return res.status(403).json({
      ok: false,
      code: "subscription_expired",
      error: "لا يوجد اشتراك.",
      user: req.user,
      org: org ? { id: org.id, name: org.name, slug: org.slug } : null,
      subscription: null,
    });
  }
  if (isSubscriptionExpired(sub)) {
    return res.status(403).json({
      ok: false,
      code: "subscription_expired",
      error: "انتهى الاشتراك. يرجى التواصل مع الدعم لتجديد الاشتراك.",
      user: req.user,
      org: { id: org.id, name: org.name, slug: org.slug },
      subscription: {
        plan: sub.plan,
        duration: sub.duration,
        status: sub.status,
        startedAt: sub.startedAt,
        endsAt: sub.endsAt,
      },
    });
  }
  const plan = sub.plan;
  req.org = org;
  req.subscription = sub;
  req.plan = plan;
  req.limits = PLANS[plan] ? { ...PLANS[plan] } : null;

  const enabledModuleKeys = getEnabledModulesForPlan(plan);
  const isOuser = req.role === "ouser" || req.role === "employee";
  if (isOuser) {
    const perms = await accounts.getOuserModulePermissionsForPlan(req.user.id, enabledModuleKeys);
    req.modulePermissions = perms; // { moduleKey: 'read'|'read_write' }
    req.allowedModules = new Set(Object.keys(perms));
  } else {
    req.modulePermissions = Object.fromEntries(enabledModuleKeys.map((k) => [k, "read_write"]));
    req.allowedModules = new Set(enabledModuleKeys);
  }
  next();
}

/**
 * Check plan allows module and (if Ouser) user has at least read permission. Call after requirePlan.
 */
export function requireModule(moduleKey) {
  return (req, res, next) => {
    if (!isModuleEnabled(req.plan, moduleKey)) {
      return res.status(403).json({ ok: false, error: "هذه الميزة غير متاحة في خطتك. يرجى الترقية." });
    }
    const isOuser = req.role === "ouser" || req.role === "employee";
    if (isOuser && (!req.allowedModules || !req.allowedModules.has(moduleKey))) {
      return res.status(403).json({ ok: false, error: "غير مصرح لك بالوصول لهذا القسم." });
    }
    next();
  };
}

/**
 * Require read_write for this module (for POST/PUT/DELETE). Call after requireModule(moduleKey).
 */
export function requireModuleWrite(moduleKey) {
  return (req, res, next) => {
    const isOuser = req.role === "ouser" || req.role === "employee";
    if (!isOuser) return next();
    const perm = req.modulePermissions?.[moduleKey];
    if (perm !== "read_write") {
      return res.status(403).json({ ok: false, error: "لديك صلاحية عرض فقط. التعديل غير مسموح." });
    }
    next();
  };
}

/**
 * Respond with 409 and upgrade message when limit reached.
 */
export function limitReached(res) {
  return res.status(409).json({
    ok: false,
    code: "PLAN_LIMIT_REACHED",
    error: UPGRADE_MSG,
  });
}

/**
 * Returns true if at/over limit (and sends 409); false if can proceed.
 */
export async function checkLimitReached(req, res, usageKey, limitKey) {
  const { getLimit } = await import("../config/plans.js");
  const { getUsage } = await import("../db/usage.js");
  const usage = await getUsage(req.orgId);
  const limit = getLimit(req.plan, limitKey);
  if (limit != null && (usage[usageKey] ?? 0) >= limit) {
    limitReached(res);
    return true;
  }
  return false;
}

export { UPGRADE_MSG, getLimit };
