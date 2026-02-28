/**
 * Public tracking: POST /api/track-visit, /api/heartbeat, /api/track-event.
 * See docs/DASHBOARD_API_CONTRACTS.md and DASHBOARD_TRACKING_SPEC.md.
 */
import crypto from "crypto";
import express from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { trackVisitLimiter, heartbeatLimiter, trackEventLimiter } from "../middleware/rateLimit.js";
import {
  upsertVisitorSession,
  upsertUserHeartbeat,
  insertActivityEvent,
} from "../db/dashboard-db.js";

const router = express.Router();
const EVENT_TYPES = ["login", "signup", "app_open", "action"];
const SESSION_ID_MAX = 256;
const ACTION_NAME_MAX = 128;
const salt = process.env.VISIT_HASH_SALT || "dashboard-visit-salt";

function hash(str) {
  return crypto.createHash("sha256").update(str || "").digest("hex");
}

function getClientIp(req) {
  const xff = req.headers["x-forwarded-for"];
  if (xff) return String(xff).split(",")[0].trim();
  return req.ip || req.socket?.remoteAddress || "";
}

/** Optional auth: set req.userId if valid Bearer token. */
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    req.userId = null;
    return next();
  }
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.userId = decoded.userId ?? null;
  } catch {
    req.userId = null;
  }
  next();
}

/** Require auth for heartbeat: 401 Unauthorized if no valid token. */
function requireUserId(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    const userId = decoded.userId;
    if (!userId) return res.status(401).json({ ok: false, error: "Unauthorized" });
    req.userId = userId;
    next();
  } catch {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }
}

/** POST /api/track-visit */
router.post("/track-visit", trackVisitLimiter, (req, res) => {
  const sessionId = typeof req.body?.sessionId === "string" ? req.body.sessionId.trim() : "";
  if (!sessionId || sessionId.length > SESSION_ID_MAX) {
    return res.status(400).json({ ok: false, error: "sessionId is required" });
  }
  const ip = getClientIp(req);
  const ua = req.headers["user-agent"] || "";
  const ipHash = hash(salt + ip);
  const uaHash = hash(ua);
  upsertVisitorSession(sessionId, ipHash, uaHash).catch((err) => console.error("[track-visit]", err));
  return res.json({ ok: true });
});

/** POST /api/heartbeat */
router.post("/heartbeat", heartbeatLimiter, requireUserId, (req, res) => {
  upsertUserHeartbeat(req.userId).catch((err) => console.error("[heartbeat]", err));
  return res.json({ ok: true });
});

/** POST /api/track-event */
router.post("/track-event", trackEventLimiter, optionalAuth, (req, res) => {
  const type = req.body?.type;
  if (!type || !EVENT_TYPES.includes(type)) {
    return res.status(400).json({
      ok: false,
      error: "type must be one of: login, signup, app_open, action",
    });
  }
  const actionName = typeof req.body?.actionName === "string"
    ? req.body.actionName.slice(0, ACTION_NAME_MAX)
    : null;
  insertActivityEvent({
    userId: req.userId ?? null,
    eventType: type,
    actionName: actionName || null,
  }).catch((err) => console.error("[track-event]", err));
  return res.json({ ok: true });
});

export default router;
