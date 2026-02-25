/**
 * Dashboard API: platform-wide stats and user list.
 * Protected by DASHBOARD_SECRET (header X-Dashboard-Secret or Authorization: Bearer <secret>).
 */
import express from "express";
import { getDashboardStats, getDashboardUsers } from "../db/dashboard-db.js";
import { getTotalVisitsAsync } from "../db/visits-store.js";

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
    return res.status(401).json({ ok: false, error: "Unauthorized." });
  }
  next();
}

router.use(requireDashboardSecret);

router.get("/stats", async (req, res) => {
  try {
    const stats = await getDashboardStats();
    if (stats === null) {
      return res.status(503).json({
        ok: false,
        error: "Database not configured (Supabase).",
      });
    }
    stats.totalVisits = await getTotalVisitsAsync();
    return res.json({ ok: true, stats });
  } catch (e) {
    console.error("[dashboard/stats]", e);
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

router.get("/users", async (req, res) => {
  try {
    const users = await getDashboardUsers();
    return res.json({ ok: true, users });
  } catch (e) {
    console.error("[dashboard/users]", e);
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

export default router;
