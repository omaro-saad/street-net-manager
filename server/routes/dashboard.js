/**
 * Dashboard API: platform-wide stats and user list.
 * All routes require X-Dashboard-Secret (or Authorization: Bearer <secret>).
 */
import express from "express";
import { getDashboardStatsFull, getDashboardUsersFiltered } from "../db/dashboard-db.js";

const router = express.Router();

function requireDashboardSecret(req, res, next) {
  const secret = process.env.DASHBOARD_SECRET;
  if (!secret) {
    return res.status(503).json({
      ok: false,
      error: "Dashboard API is not configured (DASHBOARD_SECRET missing).",
    });
  }
  const headerSecret = req.headers["x-dashboard-secret"];
  const authHeader = req.headers.authorization;
  const bearerSecret = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const provided = headerSecret || bearerSecret;
  if (provided !== secret) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }
  next();
}

router.use(requireDashboardSecret);

/** GET /api/dashboard/stats — full stats per DASHBOARD_API_CONTRACTS.md */
router.get("/stats", async (req, res) => {
  const start = Date.now();
  try {
    const stats = await getDashboardStatsFull();
    if (stats === null) {
      return res.status(503).json({
        ok: false,
        error: "Database not configured (Supabase).",
      });
    }
    const responseTimeMs = Date.now() - start;
    const lastCheckAt = new Date().toISOString();
    return res.json({
      ok: true,
      stats: {
        ...stats,
        serverUp: true,
        statusText: "ok",
        responseTimeMs,
        lastCheckAt,
        appUrl: process.env.APP_URL || "",
      },
    });
  } catch (e) {
    console.error("[dashboard/stats]", e);
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

/** GET /api/dashboard/users — query: status, limit, offset. Response: { ok, users, total } */
router.get("/users", async (req, res) => {
  try {
    const status = req.query.status && ["active", "expired", "inactive"].includes(req.query.status) ? req.query.status : null;
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const { users, total } = await getDashboardUsersFiltered({ status, limit, offset });
    return res.json({ ok: true, users, total });
  } catch (e) {
    console.error("[dashboard/users]", e);
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

export default router;
