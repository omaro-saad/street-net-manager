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
