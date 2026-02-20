// src/DataContext.jsx — In-memory only, NO database
import React, { createContext, useContext, useMemo, useState } from "react";

const DataContext = createContext(null);

function safeObj(x) {
  return x && typeof x === "object" && !Array.isArray(x) ? x : {};
}
function safeArray(x) {
  return Array.isArray(x) ? x : [];
}
function nowMs() {
  return Date.now();
}
function hasFn(fn) {
  return typeof fn === "function";
}

function ensureDefaults(prev) {
  const p = safeObj(prev);
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
    updatedAt: p.updatedAt ?? nowMs(),
  };
}

export function DataProvider({ children }) {
  const [data, setData] = useState(() => ensureDefaults({}));

  const gate = useMemo(() => {
    // =========================
    // In-memory gate — all from data/setData
    // =========================
    const makeList = (key, itemsKey = "items") => () => {
      const raw = data?.[key];
      const arr = Array.isArray(raw) ? raw : safeArray(raw?.[itemsKey] ?? raw);
      return Promise.resolve(arr);
    };

    const makeAdd = (key, itemsKey = "items") => async (row) => {
      setData((prev) => {
        const p = ensureDefaults(prev);
        const root = p[key];
        const arr = Array.isArray(root) ? [...root] : safeArray(root?.[itemsKey] ?? root);
        arr.unshift(row);
        if (root && typeof root === "object" && !Array.isArray(root)) {
          return { ...p, [key]: { ...root, [itemsKey]: arr }, updatedAt: nowMs() };
        }
        return { ...p, [key]: arr, updatedAt: nowMs() };
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
        if (root && typeof root === "object" && !Array.isArray(root)) {
          return { ...p, [key]: { ...root, [itemsKey]: arr }, updatedAt: nowMs() };
        }
        return { ...p, [key]: arr, updatedAt: nowMs() };
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
        const raw = data?.lines;
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
        const raw = data?.packages;
        const arr = Array.isArray(raw) ? raw : safeArray(raw?.items ?? raw);
        return Promise.resolve(arr);
      },
      getById: (id) => {
        const arr = safeArray(data?.packages?.items ?? data?.packages);
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
      list: () => Promise.resolve(safeArray(data?.employees)),
      get: () => safeArray(data?.employees),
      getById: (id) => Promise.resolve(safeArray(data?.employees).find((x) => String(x?.id) === String(id)) ?? null),
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
        const fin = safeObj(data?.finance);
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
      listAll: async () => safeObj(data?.finance?._kv) ?? {},
      resetAll: async () => {
        setData((prev) => ({ ...prev, finance: { _kv: {} }, updatedAt: nowMs() }));
        return { ok: true };
      },
      appendAutoInvoice: async (row) => {
        const prev = safeArray((data?.finance?._kv?.autoInvoices));
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
          const fin = safeObj(data?.finance);
          const kv = safeObj(fin._kv);
          return safeArray(kv[key]);
        },
        upsert: async (tableName, row) => {
          const key = tableName === "auto_invoices" || tableName === "autoInvoices" ? "autoInvoices" : tableName === "manual_invoices" || tableName === "manualInvoices" ? "manualInvoices" : null;
          if (!key) throw new Error(`Unsupported table: ${tableName}`);
          const id = String(row?.id ?? "").trim();
          if (!id) throw new Error(`${tableName}.upsert requires row.id`);
          const prev = safeArray((data?.finance?._kv?.[key]));
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
        const m = safeObj(data?.maps);
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
  }, [data]);

  const value = useMemo(() => ({ data, setData, gate }), [data, gate]);
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within <DataProvider>.");
  return ctx;
}
