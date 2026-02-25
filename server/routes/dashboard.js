/**
 * Dashboard API: platform-wide stats and user list.
 * Site API spec: every request must include X-Dashboard-Secret (or Authorization: Bearer <secret>).
 * DASHBOARD_SECRET must match dashboard env VITE_DASHBOARD_SECRET.
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

/** GET /api/dashboard/stats — spec: totalVisits, totalAccounts, activeSubscriptions, expiredSubscriptions, cancelledSubscriptions, totalOrganizations, planDistribution */
router.get("/stats", async (req, res) => {
  try {
    const [stats, totalVisits] = await Promise.all([
      getDashboardStats(),
      getTotalVisitsAsync(),
    ]);
    if (stats === null) {
      return res.status(503).json({
        ok: false,
        error: "Database not configured (Supabase).",
      });
    }
    const response = {
      ok: true,
      stats: {
        totalVisits: typeof totalVisits === "number" ? totalVisits : 0,
        totalAccounts: stats.totalAccounts,
        activeSubscriptions: stats.activeSubscriptions,
        expiredSubscriptions: stats.expiredSubscriptions,
        cancelledSubscriptions: stats.cancelledSubscriptions ?? 0,
        totalOrganizations: stats.totalOrganizations,
        planDistribution: stats.planDistribution,
      },
    };
    return res.json(response);
  } catch (e) {
    console.error("[dashboard/stats]", e);
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

/** GET /api/dashboard/users — spec: id, username, displayName, role, plan, status, orgName, createdAt, updatedAt, endsAt, daysLeft */
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
