// src/DataContext.jsx — In-memory only, NO database. Plan limits enforced on add.
import React, { createContext, useContext, useMemo, useState, useRef, useEffect, useCallback } from "react";
import { safeObj, safeArray, nowMs } from "./utils/helpers.js";
import { useAuth } from "./contexts/AuthContext.jsx";
import { isApiMode, PLAN_LIMIT_MESSAGE } from "./lib/api.js";
import { apiMapsGet } from "./lib/api.js";
import { loadAllInitialData } from "./lib/appInit.js";

const DataContext = createContext(null);

function getStoredTheme() {
  try {
    const t = typeof localStorage !== "undefined" ? localStorage.getItem("app_theme") : null;
    return t === "dark" || t === "light" ? t : "light";
  } catch {
    return "light";
  }
}

function ensureDefaults(prev) {
  const p = safeObj(prev);
  const admin = safeObj(p.settings?.admin);
  return {
    ...p,
    subscribers: safeArray(p.subscribers),
    distributors: safeArray(p.distributors),
    employees: safeArray(p.employees),
    lines: p.lines ?? { items: [] },
    packages: p.packages ?? { items: [] },
    packagesItems: safeArray(p.packages?.items ?? p.packages),
    finance: safeObj(p.finance),
    inventory: safeObj(p.inventory) || { warehouses: [], sections: [], items: [] },
    maps: safeObj(p.maps) || {},
    auth: p.auth && Array.isArray(p.auth.users)
      ? { users: safeArray(p.auth.users), currentUserId: p.auth.currentUserId ?? null }
      : { users: [], currentUserId: null },
    settings: {
      ...safeObj(p.settings),
      admin: {
        companyName: admin.companyName ?? "",
        companyAbout: admin.companyAbout ?? "",
        theme: admin.theme ?? getStoredTheme(),
      },
    },
    updatedAt: p.updatedAt ?? nowMs(),
  };
}

export function DataProvider({ children }) {
  const [data, setData] = useState(() => ensureDefaults({}));
  const [initDone, setInitDone] = useState(false);
  const auth = useAuth();
  const { token, allowedModules, canAccess } = auth || {};
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  // Centralized app init: load all required data after login (API mode). SplashScreen stays until this completes.
  // Wait until we have allowedModules (me loaded) so we don't call plan-restricted APIs and get 403.
  useEffect(() => {
    if (!isApiMode() || !token) {
      setInitDone(true);
      return;
    }
    if (allowedModules == null) {
      return;
    }
    let cancelled = false;
    setInitDone(false);
    loadAllInitialData(token, { allowedModules })
      .then((patch) => {
        if (cancelled) return;
        setData((prev) => ({ ...ensureDefaults(prev), ...patch }));
        setInitDone(true);
      })
      .catch(() => {
        if (!cancelled) setInitDone(true);
      });
    return () => { cancelled = true; };
  }, [token, allowedModules]);

  // Non-critical: load maps per line in background after init (so SplashScreen is already hidden).
  // Skip entirely if user does not have "map" module (avoids 403 on basic plan).
  useEffect(() => {
    if (!initDone || !token || !isApiMode()) return;
    if (!canAccess?.("map")) return;
    const raw = dataRef.current?.lines;
    const lineItems = Array.isArray(raw) ? raw : safeArray(raw?.items);
    if (!lineItems.length) return;
    let cancelled = false;
    const loadMaps = async () => {
      const next = { ...safeObj(dataRef.current?.maps) };
      const lineIds = lineItems.map((line) => (line?.id ? String(line.id) : null)).filter(Boolean);
      if (!lineIds.length) return;
      const results = await Promise.all(
        lineIds.map((lid) => apiMapsGet(token, lid).catch(() => ({ ok: false, data: null })))
      );
      if (cancelled) return;
      results.forEach((res, i) => {
        const lid = lineIds[i];
        if (res?.ok && res.data != null && lid) next[lid] = res.data;
      });
      if (cancelled) return;
      setData((prev) => ({ ...ensureDefaults(prev), maps: next, updatedAt: nowMs() }));
    };
    loadMaps();
    return () => { cancelled = true; };
  }, [initDone, token, canAccess]);

  const refreshAppData = useCallback(() => {
    if (!isApiMode() || !token || allowedModules == null) return Promise.resolve();
    return loadAllInitialData(token, { allowedModules })
      .then((patch) => setData((prev) => ({ ...ensureDefaults(prev), ...patch })))
      .catch(() => {});
  }, [token, allowedModules]);

  const gate = useMemo(() => {
    // =========================
    // In-memory gate — read latest data from ref so gate identity stays stable (avoids refetches in children).
    // =========================
    const makeList = (key, itemsKey = "items") => () => {
      const raw = dataRef.current?.[key];
      const arr = Array.isArray(raw) ? raw : safeArray(raw?.[itemsKey] ?? raw);
      return Promise.resolve(arr);
    };

    const getLimitKey = (key, row) => {
      if (key === "packages") return row?.target === "distributor" ? "packagesDistributor" : "packagesSubscriber";
      return key;
    };

    const makeAdd = (key, itemsKey = "items") => async (row) => {
      const limitKey = getLimitKey(key, row);
      const limit = auth?.getLimit?.(limitKey);
      const raw = dataRef.current?.[key];
      const arr = Array.isArray(raw) ? raw : safeArray(raw?.[itemsKey] ?? raw);
      if (limit != null && arr.length >= limit) {
        return Promise.reject(new Error(PLAN_LIMIT_MESSAGE));
      }
      setData((prev) => {
        const p = ensureDefaults(prev);
        const root = p[key];
        const nextArr = Array.isArray(root) ? [...root] : [...safeArray(root?.[itemsKey] ?? root)];
        nextArr.unshift(row);
        if (root && typeof root === "object" && !Array.isArray(root)) {
          return { ...p, [key]: { ...root, [itemsKey]: nextArr }, updatedAt: nowMs() };
        }
        return { ...p, [key]: nextArr, updatedAt: nowMs() };
      });
      return row;
    };

    const makeUpdate = (key, itemsKey = "items") => async (id, patch) => {
      setData((prev) => {
        const p = ensureDefaults(prev);
        const root = p[key];
        const arr = Array.isArray(root) ? [...root] : safeArray(root?.[itemsKey] ?? root);
        const idx = arr.findIndex((x) => String(x?.id) === String(id));
        if (idx === -1) return p;
        arr[idx] = { ...safeObj(arr[idx]), ...patch, id: String(id) };
        if (root && typeof root === "object" && !Array.isArray(root)) {
          return { ...p, [key]: { ...root, [itemsKey]: arr }, updatedAt: nowMs() };
        }
        return { ...p, [key]: arr, updatedAt: nowMs() };
      });
      return { ok: true };
    };

    const makeRemove = (key, itemsKey = "items") => async (id) => {
      setData((prev) => {
        const p = ensureDefaults(prev);
        const root = p[key];
        const arr = safeArray(Array.isArray(root) ? root : root?.[itemsKey] ?? root).filter(
          (x) => String(x?.id) !== String(id)
        );
        return root && typeof root === "object" && !Array.isArray(root)
          ? { ...p, [key]: { ...root, [itemsKey]: arr }, updatedAt: nowMs() }
          : { ...p, [key]: arr, updatedAt: nowMs() };
      });
      return { ok: true };
    };

    const noopOff = () => {};

    // Subscribers
    const subscribers = {
      isReady: true,
      list: makeList("subscribers"),
      add: (row) => makeAdd("subscribers")(row),
      update: (id, patch) => makeUpdate("subscribers")(id, patch),
      remove: (id) => makeRemove("subscribers")(id),
      onChanged: () => noopOff,
    };

    // Distributors
    const distributors = {
      isReady: true,
      list: makeList("distributors"),
      add: (row) => makeAdd("distributors")(row),
      update: (id, patch) => makeUpdate("distributors")(id, patch),
      remove: (id) => makeRemove("distributors")(id),
      onChanged: () => noopOff,
    };

    // Lines
    const lines = {
      isReady: true,
      list: () => {
        const raw = dataRef.current?.lines;
        const arr = Array.isArray(raw) ? raw : safeArray(raw?.items ?? raw);
        return Promise.resolve(arr);
      },
      add: (row) => makeAdd("lines", "items")(row),
      update: (id, patch) => makeUpdate("lines", "items")(id, patch),
      remove: (id) => makeRemove("lines", "items")(id),
      onChanged: () => noopOff,
    };

    // Packages
    const packages = {
      isReady: true,
      list: () => {
        const raw = dataRef.current?.packages;
        const arr = Array.isArray(raw) ? raw : safeArray(raw?.items ?? raw);
        return Promise.resolve(arr);
      },
      getById: (id) => {
        const arr = safeArray(dataRef.current?.packages?.items ?? dataRef.current?.packages);
        return Promise.resolve(arr.find((x) => String(x?.id) === String(id)) ?? null);
      },
      upsert: async (row) => {
        const id = String(row?.id ?? "").trim();
        if (!id) return;
        setData((prev) => {
          const p = ensureDefaults(prev);
          const root = p.packages;
          const arr = Array.isArray(root) ? [...root] : [...safeArray(root?.items ?? root)];
          const idx = arr.findIndex((x) => String(x?.id) === id);
          const merged = { ...(idx >= 0 ? arr[idx] : {}), ...row, id };
          if (idx >= 0) arr[idx] = merged;
          else arr.unshift(merged);
          return {
            ...p,
            packages: root && typeof root === "object" && !Array.isArray(root) ? { ...root, items: arr } : arr,
            updatedAt: nowMs(),
          };
        });
        return { ok: true };
      },
      remove: (id) => makeRemove("packages", "items")(id),
      clearAll: async () => {
        setData((prev) => {
          const p = ensureDefaults(prev);
          const root = p.packages;
          if (root && typeof root === "object" && !Array.isArray(root)) {
            return { ...p, packages: { ...root, items: [] }, updatedAt: nowMs() };
          }
          return { ...p, packages: [], updatedAt: nowMs() };
        });
        return { ok: true };
      },
      onChanged: () => noopOff,
    };

    // Employees
    const employees = {
      isReady: true,
      list: () => Promise.resolve(safeArray(dataRef.current?.employees)),
      get: () => safeArray(dataRef.current?.employees),
      getById: (id) => Promise.resolve(safeArray(dataRef.current?.employees).find((x) => String(x?.id) === String(id)) ?? null),
      create: (row) => makeAdd("employees")(row),
      add: (row) => makeAdd("employees")(row),
      update: (id, patch) => makeUpdate("employees")(id, patch),
      remove: (id) => makeRemove("employees")(id),
      resetAll: async () => {
        setData((prev) => ({ ...prev, employees: [], updatedAt: nowMs() }));
        return { ok: true };
      },
      onChanged: () => noopOff,
    };

    // Finance (KV in memory)
    const finance = {
      isReady: true,
      get: async (key) => {
        const fin = safeObj(dataRef.current?.finance);
        const kv = safeObj(fin._kv);
        return kv[key];
      },
      set: async (key, value) => {
        setData((prev) => {
          const p = ensureDefaults(prev);
          const fin = safeObj(p.finance);
          const kv = { ...safeObj(fin._kv), [key]: value };
          return { ...p, finance: { ...fin, _kv: kv }, updatedAt: nowMs() };
        });
        return { ok: true };
      },
      deleteKey: async (key) => {
        setData((prev) => {
          const p = ensureDefaults(prev);
          const fin = safeObj(p.finance);
          const kv = { ...safeObj(fin._kv) };
          delete kv[key];
          return { ...p, finance: { ...fin, _kv: kv }, updatedAt: nowMs() };
        });
        return { ok: true };
      },
      listAll: async () => safeObj(dataRef.current?.finance?._kv) ?? {},
      resetAll: async () => {
        setData((prev) => ({ ...prev, finance: { _kv: {} }, updatedAt: nowMs() }));
        return { ok: true };
      },
      appendAutoInvoice: async (row) => {
        const prev = safeArray((dataRef.current?.finance?._kv?.autoInvoices));
        if (prev.some((x) => String(x?.id) === String(row?.id))) return { ok: true };
        setData((p) => {
          const pp = ensureDefaults(p);
          const fin = safeObj(pp.finance);
          const kv = { ...safeObj(fin._kv), autoInvoices: [row, ...prev] };
          return { ...pp, finance: { ...fin, _kv: kv }, updatedAt: nowMs() };
        });
        return { ok: true };
      },
      onChanged: () => noopOff,
    };

    // financeDb compatibility
    const financeDb = {
      isReady: true,
      table: {
        list: async (tableName) => {
          const key = tableName === "auto_invoices" || tableName === "autoInvoices" ? "autoInvoices" : tableName === "manual_invoices" || tableName === "manualInvoices" ? "manualInvoices" : tableName;
          const fin = safeObj(dataRef.current?.finance);
          const kv = safeObj(fin._kv);
          return safeArray(kv[key]);
        },
        upsert: async (tableName, row) => {
          const key = tableName === "auto_invoices" || tableName === "autoInvoices" ? "autoInvoices" : tableName === "manual_invoices" || tableName === "manualInvoices" ? "manualInvoices" : null;
          if (!key) throw new Error(`Unsupported table: ${tableName}`);
          const id = String(row?.id ?? "").trim();
          if (!id) throw new Error(`${tableName}.upsert requires row.id`);
          const prev = safeArray((dataRef.current?.finance?._kv?.[key]));
          const next = prev.filter((x) => String(x?.id) !== id);
          next.unshift({ ...safeObj(row), updatedAt: nowMs() });
          setData((p) => {
            const pp = ensureDefaults(p);
            const fin = safeObj(pp.finance);
            const kv = { ...safeObj(fin._kv), [key]: next };
            return { ...pp, finance: { ...fin, _kv: kv }, updatedAt: nowMs() };
          });
          return { ok: true };
        },
      },
      settings: { get: () => ({ currency: "₪" }) },
    };

    // Maps (in-memory)
    const maps = {
      isReady: true,
      get: async (lineId) => {
        const m = safeObj(dataRef.current?.maps);
        return m[String(lineId)] ?? null;
      },
      save: async (lineId, payload) => {
        const lid = String(lineId ?? "").trim();
        if (!lid) return { ok: false };
        setData((prev) => {
          const p = ensureDefaults(prev);
          const next = { ...safeObj(p.maps), [lid]: payload };
          return { ...p, maps: next, updatedAt: nowMs() };
        });
        return { ok: true };
      },
      onChanged: () => noopOff,
    };

    // Invoices (package-generated)
    const invoices = {
      isReady: true,
      appendMany: async (target, rows) => {
        const arr = safeArray(rows);
        if (!arr.length) return { ok: true };
        setData((prev) => {
          const p = ensureDefaults(prev);
          const inv = safeObj(p.invoices) || { subscriber: [], distributor: [] };
          const key = target === "distributor" ? "distributor" : "subscriber";
          const existing = safeArray(inv[key]);
          return {
            ...p,
            invoices: { ...inv, [key]: [...arr, ...existing] },
            updatedAt: nowMs(),
          };
        });
        return { ok: true };
      },
    };

    // Backup — no-op (no DB to backup)
    const backup = {
      isReady: false,
      listPages: () => [],
      exportAll: () => Promise.resolve({}),
      importAll: () => Promise.resolve({}),
      resetAll: () => Promise.resolve({}),
      saveJsonAs: () => Promise.resolve({ ok: false }),
      pickAndImport: () => Promise.resolve({ ok: false }),
    };

    return {
      subscribers,
      distributors,
      lines,
      packages,
      employees,
      finance,
      financeDb,
      maps,
      invoices,
      backup,
    };
    // Gate reads from dataRef.current so we only depend on auth; stable identity avoids refetches in children when data changes.
  }, [auth]);

  const value = useMemo(() => ({ data, setData, gate, initDone, refreshAppData }), [data, gate, initDone, refreshAppData]);
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

const noop = () => {};
const emptyList = () => Promise.resolve([]);
const emptyGate = {
  subscribers: { isReady: true, list: emptyList, add: noop, update: noop, remove: noop, onChanged: () => noop },
  distributors: { isReady: true, list: emptyList, add: noop, update: noop, remove: noop, onChanged: () => noop },
  lines: { isReady: true, list: emptyList, add: noop, update: noop, remove: noop, onChanged: () => noop },
  packages: { isReady: true, list: emptyList, add: noop, update: noop, remove: noop, onChanged: () => noop },
  employees: { isReady: true, list: emptyList, add: noop, update: noop, remove: noop, onChanged: () => noop },
  finance: { isReady: true, getKv: () => Promise.resolve({}), setKv: noop, onChanged: () => noop },
  financeDb: { getKv: () => Promise.resolve({}), setKv: noop },
  maps: { get: () => Promise.resolve(null), set: noop, onChanged: () => noop },
  invoices: { list: emptyList, add: noop, update: noop, remove: noop, onChanged: () => noop },
  backup: { get: () => Promise.resolve(null), set: noop, buildSnapshot: () => Promise.resolve({}), restore: () => Promise.resolve({}) },
};

export function useData() {
  const ctx = useContext(DataContext);
  if (ctx) return ctx;
  if (typeof import.meta !== "undefined" && import.meta.env?.DEV) {
    console.warn("useData was called outside <DataProvider>. Using fallback. Ensure App is wrapped with DataProvider in main.jsx.");
  }
  return {
    data: ensureDefaults({}),
    setData: noop,
    gate: emptyGate,
    initDone: true,
    refreshAppData: () => Promise.resolve(),
  };
}
