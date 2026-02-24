/**
 * Auth routes: login, me, profile (update username), reset-password, users (create).
 * Uses DB accounts when SUPABASE_URL is set, else in-memory.
 */
import express from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { accounts } from "../db/accounts-loader.js";
import { requireAuth, requirePlan } from "../middleware/auth.js";
import { loginLimiter } from "../middleware/rateLimit.js";
import { getUsage } from "../db/usage.js";
import { getEnabledModulesForPlan } from "../config/plans.js";

const router = express.Router();

const MAX_USERNAME_LEN = 256;
const MAX_PASSWORD_LEN = 1024;

router.post("/login", loginLimiter, express.json(), async (req, res) => {
  const username = String(req.body?.username ?? "").trim().slice(0, MAX_USERNAME_LEN);
  const password = String(req.body?.password ?? "").slice(0, MAX_PASSWORD_LEN);
  if (!username || !password) {
    return res.status(400).json({ ok: false, error: "اسم المستخدم وكلمة المرور مطلوبان." });
  }

  const user = await accounts.findUserByUsername(username);
  if (!user) {
    return res.status(401).json({ ok: false, error: "اسم المستخدم أو كلمة المرور غير صحيحة." });
  }
  const valid = await accounts.verifyPassword(user, password);
  if (!valid) {
    return res.status(401).json({ ok: false, error: "اسم المستخدم أو كلمة المرور غير صحيحة." });
  }

  const org = await accounts.getOrgById(user.orgId);
  const subscription = await accounts.getSubscriptionAnyStatus?.(user.orgId) ?? (await accounts.getSubscription(user.orgId));
  if (!org || !subscription) {
    return res.status(403).json({ ok: false, error: "لا يوجد اشتراك لهذا الحساب." });
  }
  const now = Date.now();
  const endsAtMs = subscription.endsAt ? new Date(subscription.endsAt).getTime() : null;
  const isExpired = subscription.status !== "active" || (endsAtMs != null && endsAtMs <= now);
  if (isExpired) {
    return res.status(403).json({
      ok: false,
      code: "subscription_expired",
      error: "انتهى الاشتراك. يرجى التواصل مع الدعم لتجديد الاشتراك.",
      user: { id: user.id, username: user.username, orgId: user.orgId, role: user.role },
      org: { id: org.id, name: org.name, slug: org.slug },
      subscription: {
        plan: subscription.plan,
        duration: subscription.duration,
        status: subscription.status,
        startedAt: subscription.startedAt,
        endsAt: subscription.endsAt,
      },
    });
  }

  const token = jwt.sign(
    {
      userId: user.id,
      username: user.username,
      orgId: user.orgId,
      role: user.role,
    },
    config.jwtSecret,
    { expiresIn: "7d" }
  );
  return res.json({
    ok: true,
    token,
    user: {
      id: user.id,
      username: user.username,
      orgId: user.orgId,
      role: user.role,
      displayName: user.displayName,
    },
  });
});

router.get("/me", requireAuth, requirePlan, async (req, res) => {
  try {
    const usage = await getUsage(req.orgId);
    const allowedModules = [...(req.allowedModules || [])];
    const modulePermissions = req.modulePermissions || null;

    let oadminUsername = null;
    if (req.role === "ouser" || req.role === "employee") {
      oadminUsername = await accounts.getOadminUsernameForOrg(req.orgId);
    }

    return res.json({
      ok: true,
      user: req.user,
      org: req.org ? { id: req.org.id, name: req.org.name, slug: req.org.slug } : null,
      subscription: req.subscription
        ? {
            plan: req.subscription.plan,
            duration: req.subscription.duration,
            status: req.subscription.status,
            startedAt: req.subscription.startedAt,
            endsAt: req.subscription.endsAt,
          }
        : null,
      role: req.role,
      oadminUsername,
      allowedModules,
      modulePermissions,
      limits: req.limits || null,
      usage,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// ——— Update username (authenticated; requires secret code like password change) ———
router.patch("/profile/username", express.json(), requireAuth, async (req, res) => {
  const newUsername = String(req.body?.newUsername ?? "").trim();
  const secretCode = String(req.body?.secretCode ?? "").trim();
  if (!newUsername) {
    return res.status(400).json({ ok: false, error: "اسم المستخدم الجديد مطلوب." });
  }
  if (!secretCode) {
    return res.status(400).json({ ok: false, error: "الرمز السري مطلوب للتحقق." });
  }
  const result = await accounts.validateSecretCodeAndUpdateUsername(req.user.id, secretCode, newUsername);
  if (!result.ok) {
    return res.status(400).json({ ok: false, error: result.error });
  }
  return res.json({
    ok: true,
    user: {
      id: req.user.id,
      username: newUsername,
      orgId: req.user.orgId,
      role: req.user.role,
      displayName: req.user.displayName,
    },
  });
});

// ——— Reset password (no auth: username + secret code + new password) ———
router.post("/reset-password", express.json(), async (req, res) => {
  const username = String(req.body?.username ?? "").trim();
  const resetCode = String(req.body?.resetCode ?? "").trim();
  const newPassword = String(req.body?.newPassword ?? "").trim();
  if (!username || !resetCode || !newPassword) {
    return res.status(400).json({
      ok: false,
      error: "اسم المستخدم ورمز إعادة التعيين وكلمة المرور الجديدة مطلوبة.",
    });
  }
  const result = await accounts.validateResetCodeAndSetPassword(username, resetCode, newPassword);
  if (!result.ok) {
    return res.status(400).json({ ok: false, error: result.error });
  }
  return res.json({ ok: true, message: "تم تحديث كلمة المرور بنجاح." });
});

// ——— Create user (admin: returns user + resetCode once) ———
router.post("/users", express.json(), requireAuth, requirePlan, async (req, res) => {
  if (req.role !== "oadmin") {
    return res.status(403).json({ ok: false, error: "غير مصرح بإنشاء مستخدمين." });
  }
  const username = String(req.body?.username ?? "").trim();
  const password = String(req.body?.password ?? "").trim();
  const orgId = req.body?.orgId ?? req.user?.orgId;
  const role = req.body?.role ?? "ouser";
  const displayName = String(req.body?.displayName ?? username).trim();
  if (!orgId) {
    return res.status(400).json({ ok: false, error: "المؤسسة مطلوبة." });
  }
  const result = await accounts.createUser(username, password, { orgId, role, displayName });
  if (!result.ok) {
    return res.status(400).json({ ok: false, error: result.error });
  }
  return res.status(201).json({
    ok: true,
    user: result.user,
    resetCode: result.resetCode,
    message: "تم إنشاء المستخدم. احفظ رمز إعادة التعيين وعرضه للمستخدم مرة واحدة فقط.",
  });
});

// ——— Ouser list (Oadmin only, same org) ———
router.get("/ousers", requireAuth, requirePlan, async (req, res) => {
  if (req.role !== "oadmin") {
    return res.status(403).json({ ok: false, error: "غير مصرح." });
  }
  const list = await accounts.listOusersByOrgId(req.orgId);
  return res.json({ ok: true, ousers: list });
});

// ——— Ouser permissions: get (Oadmin only) ———
router.get("/ousers/:id/permissions", requireAuth, requirePlan, async (req, res) => {
  if (req.role !== "oadmin") {
    return res.status(403).json({ ok: false, error: "غير مصرح." });
  }
  const ouserId = req.params.id;
  const ouser = await accounts.findUserById(ouserId);
  if (!ouser || ouser.orgId !== req.orgId || ouser.role !== "ouser") {
    return res.status(404).json({ ok: false, error: "المستخدم غير موجود." });
  }
  const enabledModuleKeys = getEnabledModulesForPlan(req.plan);
  const permissions = await accounts.getOuserModulePermissionsForPlan(ouserId, enabledModuleKeys);
  return res.json({
    ok: true,
    allowedModules: enabledModuleKeys,
    permissions, // { moduleKey: "read"|"read_write" }
  });
});

// ——— Ouser permissions: set (Oadmin only). body.permissions = { moduleKey: "read"|"read_write" } ———
router.patch("/ousers/:id/permissions", express.json(), requireAuth, requirePlan, async (req, res) => {
  if (req.role !== "oadmin") {
    return res.status(403).json({ ok: false, error: "غير مصرح." });
  }
  const ouserId = req.params.id;
  const ouser = await accounts.findUserById(ouserId);
  if (!ouser || ouser.orgId !== req.orgId || ouser.role !== "ouser") {
    return res.status(404).json({ ok: false, error: "المستخدم غير موجود." });
  }
  const enabledModuleKeys = getEnabledModulesForPlan(req.plan);
  const requested = req.body?.permissions && typeof req.body.permissions === "object" ? req.body.permissions : {};
  const filtered = {};
  for (const k of enabledModuleKeys) {
    const v = requested[k];
    if (v === "read" || v === "read_write") filtered[k] = v;
  }
  const result = await accounts.setOuserPermissions(ouserId, filtered);
  if (!result.ok) {
    return res.status(400).json({ ok: false, error: result.error });
  }
  return res.json({ ok: true, permissions: filtered });
});

export default router;
