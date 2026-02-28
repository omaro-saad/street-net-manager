/**
 * Rate limiting: prevent brute-force and scripted abuse.
 */
import { rateLimit } from "express-rate-limit";
import { config } from "../config.js";

const windowMs = 15 * 60 * 1000; // 15 minutes

/** Strict limit for login: 10 attempts per 15 min per IP. */
export const loginLimiter = rateLimit({
  windowMs,
  limit: 10,
  message: { ok: false, error: "محاولات كثيرة. حاول لاحقاً." },
  standardHeaders: true,
  legacyHeaders: false,
});

/** General API: 300 requests per 15 min per IP (authenticated usage). */
export const apiLimiter = rateLimit({
  windowMs,
  limit: 300,
  message: { ok: false, error: "طلبات كثيرة. انتظر قليلاً." },
  standardHeaders: true,
  legacyHeaders: false,
});

const oneMinute = 60 * 1000;

/** Tracking: 60/min per IP for track-visit and track-event. */
export const trackVisitLimiter = rateLimit({
  windowMs: oneMinute,
  limit: 60,
  message: { ok: false, error: "Too many requests" },
  standardHeaders: true,
  legacyHeaders: false,
});

/** Heartbeat: 120/min per IP (one every 60s leaves headroom). */
export const heartbeatLimiter = rateLimit({
  windowMs: oneMinute,
  limit: 120,
  message: { ok: false, error: "Too many requests" },
  standardHeaders: true,
  legacyHeaders: false,
});

/** Track-event: 120/min per IP. */
export const trackEventLimiter = rateLimit({
  windowMs: oneMinute,
  limit: 120,
  message: { ok: false, error: "Too many requests" },
  standardHeaders: true,
  legacyHeaders: false,
});
