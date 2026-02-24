/**
 * REST API for all entities. All routes require auth + plan; limits enforced on create.
 */
import express from "express";
import { requireAuth, requirePlan, requireModule, requireModuleWrite, limitReached, checkLimitReached } from "../middleware/auth.js";
import { getFullState, setFullState, state } from "../db/store.js";
import { backup } from "../db/backup-loader.js";
import { maps } from "../db/maps-loader.js";
import { subscribers } from "../db/subscribers-loader.js";
import { distributors } from "../db/distributors-loader.js";
import { lines } from "../db/lines-loader.js";
import { packages } from "../db/packages-loader.js";
import { employees } from "../db/employees-loader.js";
import { inventory } from "../db/inventory-loader.js";
import { finance } from "../db/finance-loader.js";
import { settings } from "../db/settings-loader.js";
import { getUsage } from "../db/usage.js";

const router = express.Router();

router.use(requireAuth);
router.use(requirePlan);
router.use(express.json({ limit: "10mb" }));

// ——— Full data sync (for linking frontend) ———
router.get("/data", (req, res) => {
  try {
    const data = getFullState();
    return res.json({ ok: true, data });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

router.put("/data", (req, res) => {
  if (req.role !== "oadmin") {
    return res.status(403).json({ ok: false, error: "صلاحية التعديل الكامل للبيانات للمسؤول فقط." });
  }
  try {
    const data = setFullState(req.body?.data ?? req.body);
    return res.json({ ok: true, data });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// ——— Backup (admin only, one file per org in DB; linked by org_id) ———
router.get("/backup", async (req, res) => {
  if (req.role !== "oadmin") {
    return res.status(403).json({ ok: false, error: "صلاحية النسخ الاحتياطي للمسؤول فقط." });
  }
  try {
    const data = await backup.get(req.orgId);
    return res.json({ ok: true, backup: data });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

router.post("/backup", async (req, res) => {
  if (req.role !== "oadmin") {
    return res.status(403).json({ ok: false, error: "صلاحية النسخ الاحتياطي للمسؤول فقط." });
  }
  try {
    const fromBody = req.body?.data ?? req.body;
    const snapshot = fromBody && typeof fromBody === "object" && Object.keys(fromBody).length > 0
      ? fromBody
      : await backup.buildSnapshot(req.orgId);
    await backup.set(req.orgId, snapshot);
    return res.json({ ok: true, message: "تم حفظ النسخة الاحتياطية." });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

router.post("/backup/restore", async (req, res) => {
  if (req.role !== "oadmin") {
    return res.status(403).json({ ok: false, error: "صلاحية الاستعادة للمسؤول فقط." });
  }
  try {
    const data = await backup.get(req.orgId);
    if (!data) {
      return res.status(404).json({ ok: false, error: "لا توجد نسخة احتياطية للاستعادة." });
    }
    const restored = await backup.restore(req.orgId, data);
    return res.json({ ok: true, data: restored, message: "تم استعادة النسخة الاحتياطية." });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// ——— Delete all org data (admin only; keeps backup + accounts) ———
router.post("/data/delete-all", async (req, res) => {
  if (req.role !== "oadmin") {
    return res.status(403).json({ ok: false, error: "صلاحية حذف كل البيانات للمسؤول فقط." });
  }
  const orgId = req.orgId;
  const useDb = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
  try {
    if (useDb) {
      const { deleteAllByOrgId: deleteSubscribers } = await import("../db/subscribers-db.js");
      const { deleteAllByOrgId: deleteDistributors } = await import("../db/distributors-db.js");
      const { deleteAllByOrgId: deleteLines } = await import("../db/lines-db.js");
      const { deleteAllByOrgId: deletePackages } = await import("../db/packages-db.js");
      const { deleteAllByOrgId: deleteEmployees } = await import("../db/employees-db.js");
      const { deleteAllByOrgId: deleteMaps } = await import("../db/maps-db.js");
      const { setAll: financeSetAll } = await import("../db/finance-db.js");
      const { set: inventorySet } = await import("../db/inventory-db.js");
      const { set: settingsSet } = await import("../db/settings-db.js");
      await Promise.all([
        deleteSubscribers(orgId),
        deleteDistributors(orgId),
        deleteMaps(orgId),
        deleteLines(orgId),
        deletePackages(orgId),
        deleteEmployees(orgId),
      ]);
      await financeSetAll(orgId, {});
      await inventorySet(orgId, { warehouses: [], sections: [], items: [] });
      await settingsSet(orgId, { admin: { theme: "light", companyName: "", companyAbout: "" } });
    } else {
      const current = getFullState();
      const emptyState = {
        subscribers: [],
        distributors: [],
        employees: [],
        lines: { items: [] },
        packages: { items: [] },
        finance: { _kv: {} },
        inventory: { warehouses: [], sections: [], items: [] },
        maps: {},
        auth: current.auth || state.auth,
        settings: { admin: { theme: "light", companyName: "", companyAbout: "" } },
      };
      setFullState(emptyState);
    }
    return res.json({ ok: true, message: "تم حذف كل البيانات." });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// ——— Subscribers (DB when Supabase set, else store) ———
router.get("/subscribers", requireModule("subscribers"), async (req, res) => {
  try {
    const list = await subscribers.list(req.orgId);
    return res.json({ ok: true, data: list });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});
router.post("/subscribers", requireModule("subscribers"), requireModuleWrite("subscribers"), async (req, res) => {
  try {
    if (await checkLimitReached(req, res, "subscribers", "subscribers")) return;
    const row = await subscribers.add(req.orgId, req.body);
    return res.status(201).json({ ok: true, data: row });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});
router.put("/subscribers/:id", requireModule("subscribers"), requireModuleWrite("subscribers"), async (req, res) => {
  try {
    const row = await subscribers.update(req.orgId, req.params.id, req.body);
    if (!row) return res.status(404).json({ ok: false, error: "غير موجود." });
    return res.json({ ok: true, data: row });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});
router.delete("/subscribers/:id", requireModule("subscribers"), requireModuleWrite("subscribers"), async (req, res) => {
  try {
    await subscribers.remove(req.orgId, req.params.id);
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// ——— Distributors (DB when Supabase set, else store) ———
router.get("/distributors", requireModule("distributors"), async (req, res) => {
  try {
    const list = await distributors.list(req.orgId);
    return res.json({ ok: true, data: list });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});
router.post("/distributors", requireModule("distributors"), requireModuleWrite("distributors"), async (req, res) => {
  try {
    if (await checkLimitReached(req, res, "distributors", "distributors")) return;
    const row = await distributors.add(req.orgId, req.body);
    return res.status(201).json({ ok: true, data: row });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});
router.put("/distributors/:id", requireModule("distributors"), requireModuleWrite("distributors"), async (req, res) => {
  try {
    const row = await distributors.update(req.orgId, req.params.id, req.body);
    if (!row) return res.status(404).json({ ok: false, error: "غير موجود." });
    return res.json({ ok: true, data: row });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});
router.delete("/distributors/:id", requireModule("distributors"), requireModuleWrite("distributors"), async (req, res) => {
  try {
    await distributors.remove(req.orgId, req.params.id);
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// ——— Lines (DB when Supabase set, else store) ———
router.get("/lines", requireModule("lines"), async (req, res) => {
  try {
    const list = await lines.list(req.orgId);
    return res.json({ ok: true, data: list });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});
router.post("/lines", requireModule("lines"), requireModuleWrite("lines"), async (req, res) => {
  try {
    if (await checkLimitReached(req, res, "lines", "lines")) return;
    const row = await lines.add(req.orgId, req.body);
    return res.status(201).json({ ok: true, data: row });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});
router.put("/lines/:id", requireModule("lines"), requireModuleWrite("lines"), async (req, res) => {
  try {
    const row = await lines.update(req.orgId, req.params.id, req.body);
    if (!row) return res.status(404).json({ ok: false, error: "غير موجود." });
    return res.json({ ok: true, data: row });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});
router.delete("/lines/:id", requireModule("lines"), requireModuleWrite("lines"), async (req, res) => {
  try {
    await lines.remove(req.orgId, req.params.id);
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// ——— Packages (DB when Supabase set, else store) ———
router.get("/packages", requireModule("packages"), async (req, res) => {
  try {
    const list = await packages.list(req.orgId);
    return res.json({ ok: true, data: list });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});
router.post("/packages", requireModule("packages"), requireModuleWrite("packages"), async (req, res) => {
  try {
    const target = req.body?.target === "distributor" ? "distributor" : "subscriber";
    const usageKey = target === "distributor" ? "packagesDistributor" : "packagesSubscriber";
    const limitKey = target === "distributor" ? "packagesDistributor" : "packagesSubscriber";
    if (await checkLimitReached(req, res, usageKey, limitKey)) return;
    const row = await packages.add(req.orgId, req.body);
    return res.status(201).json({ ok: true, data: row });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});
router.put("/packages/:id", requireModule("packages"), requireModuleWrite("packages"), async (req, res) => {
  try {
    const row = await packages.update(req.orgId, req.params.id, req.body);
    if (!row) return res.status(404).json({ ok: false, error: "غير موجود." });
    return res.json({ ok: true, data: row });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});
router.delete("/packages/:id", requireModule("packages"), requireModuleWrite("packages"), async (req, res) => {
  try {
    await packages.remove(req.orgId, req.params.id);
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// ——— Employees ———
router.get("/employees", requireModule("employee"), async (req, res) => {
  try {
    const list = await employees.list(req.orgId);
    return res.json({ ok: true, data: list });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});
router.post("/employees", requireModule("employee"), requireModuleWrite("employee"), async (req, res) => {
  try {
    if (await checkLimitReached(req, res, "employees", "employees")) return;
    const row = await employees.add(req.orgId, req.body);
    return res.status(201).json({ ok: true, data: row });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});
router.put("/employees/:id", requireModule("employee"), requireModuleWrite("employee"), async (req, res) => {
  try {
    const row = await employees.update(req.orgId, req.params.id, req.body);
    if (!row) return res.status(404).json({ ok: false, error: "غير موجود." });
    return res.json({ ok: true, data: row });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});
router.delete("/employees/:id", requireModule("employee"), requireModuleWrite("employee"), async (req, res) => {
  try {
    await employees.remove(req.orgId, req.params.id);
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// ——— Finance (key-value) ———
router.get("/finance", requireModule("finance"), async (req, res) => {
  try {
    const kv = await finance.getKv(req.orgId);
    return res.json({ ok: true, data: kv });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});
router.put("/finance", requireModule("finance"), requireModuleWrite("finance"), async (req, res) => {
  try {
    const kv = req.body;
    if (!kv || typeof kv !== "object") {
      const data = await finance.getKv(req.orgId);
      return res.json({ ok: true, data });
    }
    const manualInvoices = Array.isArray(kv.manualInvoices) ? kv.manualInvoices : undefined;
    if (manualInvoices != null && req.limits?.financeManual != null && manualInvoices.length > req.limits.financeManual) {
      return limitReached(res);
    }
    const current = await finance.getKv(req.orgId);
    const merged = { ...current, ...kv };
    if (typeof finance.setAll === "function") {
      await finance.setAll(req.orgId, merged);
    } else {
      for (const [k, v] of Object.entries(kv)) await finance.setKv(req.orgId, k, v);
    }
    const data = await finance.getKv(req.orgId);
    return res.json({ ok: true, data });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// ——— Inventory (devices: warehouses = stores) ———
router.get("/inventory", requireModule("devices"), async (req, res) => {
  try {
    const data = await inventory.get(req.orgId);
    return res.json({ ok: true, data });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});
router.put("/inventory", requireModule("devices"), requireModuleWrite("devices"), async (req, res) => {
  try {
    const warehouses = Array.isArray(req.body?.warehouses) ? req.body.warehouses : [];
    const limit = req.limits?.devicesStores;
    if (limit != null && warehouses.length > limit) {
      return limitReached(res);
    }
    await inventory.set(req.orgId, req.body);
    const data = await inventory.get(req.orgId);
    return res.json({ ok: true, data });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// ——— Settings (theme, company name, about) ———
router.get("/settings", requireModule("settings"), async (req, res) => {
  try {
    const data = await settings.get(req.orgId);
    return res.json({ ok: true, data });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});
router.put("/settings", requireModule("settings"), requireModuleWrite("settings"), async (req, res) => {
  try {
    const payload = req.body && typeof req.body === "object" ? req.body : {};
    await settings.set(req.orgId, payload);
    const data = await settings.get(req.orgId);
    return res.json({ ok: true, data });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// ——— Maps (DB when Supabase set, else store) ———
router.get("/maps/:lineId", requireModule("map"), async (req, res) => {
  try {
    const data = await maps.get(req.orgId, req.params.lineId);
    return res.json({ ok: true, data });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});
router.put("/maps/:lineId", requireModule("map"), requireModuleWrite("map"), async (req, res) => {
  try {
    const payload = req.body;
    const nodes = payload?.nodes ?? [];
    const limit = req.limits?.mapNodesPerLine;
    if (limit != null && nodes.length > limit) {
      return limitReached(res);
    }
    await maps.set(req.orgId, req.params.lineId, payload);
    const data = await maps.get(req.orgId, req.params.lineId);
    return res.json({ ok: true, data });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

export default router;
