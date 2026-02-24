/**
 * In-memory store — same shape as frontend DataContext.
 * Replace with db/sqlite.js when linking a real DB.
 */
function safeArray(x) {
  return Array.isArray(x) ? x : [];
}
function safeObj(x) {
  return x && typeof x === "object" && !Array.isArray(x) ? x : {};
}
function nowMs() {
  return Date.now();
}

export const state = {
  subscribers: [],
  distributors: [],
  employees: [],
  lines: { items: [] },
  packages: { items: [] },
  finance: { _kv: {} },
  inventory: { warehouses: [], sections: [], items: [] },
  maps: {},
  auth: { users: [], currentUserId: null },
  updatedAt: nowMs(),
  /** Single backup blob per org (replace on each backup). */
  backup: null,
  /** App settings (admin: theme, companyName, companyAbout). In-memory when no Supabase. */
  settings: { admin: { theme: "light", companyName: "", companyAbout: "" } },
};

export function getFullState() {
  return JSON.parse(JSON.stringify(state));
}

export function getBackup() {
  return state.backup ? JSON.parse(JSON.stringify(state.backup)) : null;
}

export function setBackup(snapshot) {
  state.backup = snapshot && typeof snapshot === "object" ? JSON.parse(JSON.stringify(snapshot)) : null;
  return state.backup;
}

export function setFullState(next) {
  const p = safeObj(next);
  state.subscribers = safeArray(p.subscribers);
  state.distributors = safeArray(p.distributors);
  state.employees = safeArray(p.employees);
  state.lines = p.lines && typeof p.lines === "object" ? { items: safeArray(p.lines.items) } : { items: [] };
  const pkgs = p.packages;
  state.packages = Array.isArray(pkgs) ? pkgs : safeArray(pkgs?.items ?? pkgs);
  if (state.packages && typeof state.packages === "object" && !Array.isArray(state.packages)) {
    state.packages = { ...state.packages, items: safeArray(state.packages.items) };
  } else if (Array.isArray(state.packages)) {
    state.packages = { items: state.packages };
  }
  state.finance = safeObj(p.finance);
  if (!state.finance._kv) state.finance._kv = {};
  state.inventory = safeObj(p.inventory);
  if (!state.inventory.warehouses) state.inventory.warehouses = [];
  if (!state.inventory.sections) state.inventory.sections = [];
  if (!state.inventory.items) state.inventory.items = [];
  state.maps = safeObj(p.maps);
  state.auth = p.auth && Array.isArray(p.auth.users)
    ? { users: safeArray(p.auth.users), currentUserId: p.auth.currentUserId ?? null }
    : { users: [], currentUserId: null };
  if (p.settings && typeof p.settings === "object" && p.settings.admin) {
    const a = p.settings.admin;
    state.settings = {
      admin: {
        theme: a.theme === "dark" ? "dark" : "light",
        companyName: typeof a.companyName === "string" ? a.companyName : "",
        companyAbout: typeof a.companyAbout === "string" ? a.companyAbout : "",
      },
    };
  }
  state.updatedAt = nowMs();
  return getFullState();
}

function linesItems() {
  return state.lines?.items ? state.lines.items : [];
}
function packagesItems() {
  const p = state.packages;
  return Array.isArray(p) ? p : (p?.items ? p.items : []);
}

export const subscribers = {
  list: () => Promise.resolve([...state.subscribers]),
  add: (row) => {
    state.subscribers.unshift(row);
    state.updatedAt = nowMs();
    return Promise.resolve(row);
  },
  update: (id, patch) => {
    const idx = state.subscribers.findIndex((x) => String(x?.id) === String(id));
    if (idx === -1) return Promise.resolve(null);
    state.subscribers[idx] = { ...state.subscribers[idx], ...patch, id: String(id) };
    state.updatedAt = nowMs();
    return Promise.resolve(state.subscribers[idx]);
  },
  remove: (id) => {
    state.subscribers = state.subscribers.filter((x) => String(x?.id) !== String(id));
    state.updatedAt = nowMs();
    return Promise.resolve({ ok: true });
  },
};

export const distributors = {
  list: () => Promise.resolve([...state.distributors]),
  add: (row) => {
    state.distributors.unshift(row);
    state.updatedAt = nowMs();
    return Promise.resolve(row);
  },
  update: (id, patch) => {
    const idx = state.distributors.findIndex((x) => String(x?.id) === String(id));
    if (idx === -1) return Promise.resolve(null);
    state.distributors[idx] = { ...state.distributors[idx], ...patch, id: String(id) };
    state.updatedAt = nowMs();
    return Promise.resolve(state.distributors[idx]);
  },
  remove: (id) => {
    state.distributors = state.distributors.filter((x) => String(x?.id) !== String(id));
    state.updatedAt = nowMs();
    return Promise.resolve({ ok: true });
  },
};

export const lines = {
  list: () => Promise.resolve([...linesItems()]),
  add: (row) => {
    if (!state.lines) state.lines = { items: [] };
    state.lines.items = state.lines.items || [];
    state.lines.items.unshift(row);
    state.updatedAt = nowMs();
    return Promise.resolve(row);
  },
  update: (id, patch) => {
    const arr = linesItems();
    const idx = arr.findIndex((x) => String(x?.id) === String(id));
    if (idx === -1) return Promise.resolve(null);
    state.lines.items[idx] = { ...state.lines.items[idx], ...patch, id: String(id) };
    state.updatedAt = nowMs();
    return Promise.resolve(state.lines.items[idx]);
  },
  remove: (id) => {
    if (state.lines?.items) state.lines.items = state.lines.items.filter((x) => String(x?.id) !== String(id));
    state.updatedAt = nowMs();
    return Promise.resolve({ ok: true });
  },
};

export const packages = {
  list: () => Promise.resolve([...packagesItems()]),
  add: (row) => {
    if (!state.packages) state.packages = { items: [] };
    const items = Array.isArray(state.packages) ? state.packages : (state.packages.items || []);
    items.unshift(row);
    state.packages = Array.isArray(state.packages) ? items : { ...state.packages, items };
    state.updatedAt = nowMs();
    return Promise.resolve(row);
  },
  update: (id, patch) => {
    const arr = packagesItems();
    const idx = arr.findIndex((x) => String(x?.id) === String(id));
    if (idx === -1) return Promise.resolve(null);
    const next = [...arr];
    next[idx] = { ...next[idx], ...patch, id: String(id) };
    state.packages = state.packages && typeof state.packages === "object" && !Array.isArray(state.packages)
      ? { ...state.packages, items: next }
      : next;
    state.updatedAt = nowMs();
    return Promise.resolve(next[idx]);
  },
  remove: (id) => {
    const arr = packagesItems().filter((x) => String(x?.id) !== String(id));
    state.packages = state.packages && typeof state.packages === "object" && !Array.isArray(state.packages)
      ? { ...state.packages, items: arr }
      : arr;
    state.updatedAt = nowMs();
    return Promise.resolve({ ok: true });
  },
};

export const employees = {
  list: () => Promise.resolve([...state.employees]),
  add: (row) => {
    state.employees.unshift(row);
    state.updatedAt = nowMs();
    return Promise.resolve(row);
  },
  update: (id, patch) => {
    const idx = state.employees.findIndex((x) => String(x?.id) === String(id));
    if (idx === -1) return Promise.resolve(null);
    state.employees[idx] = { ...state.employees[idx], ...patch, id: String(id) };
    state.updatedAt = nowMs();
    return Promise.resolve(state.employees[idx]);
  },
  remove: (id) => {
    state.employees = state.employees.filter((x) => String(x?.id) !== String(id));
    state.updatedAt = nowMs();
    return Promise.resolve({ ok: true });
  },
};

export const finance = {
  getKv: () => Promise.resolve({ ...(state.finance._kv || {}) }),
  setKv: (key, value) => {
    if (!state.finance._kv) state.finance._kv = {};
    state.finance._kv[key] = value;
    state.updatedAt = nowMs();
    return Promise.resolve();
  },
  setAll: (kv) => {
    state.finance._kv = kv && typeof kv === "object" && !Array.isArray(kv) ? { ...kv } : {};
    state.updatedAt = nowMs();
    return Promise.resolve();
  },
};

export const inventory = {
  get: () => Promise.resolve(JSON.parse(JSON.stringify(state.inventory))),
  set: (next) => {
    state.inventory = next;
    state.updatedAt = nowMs();
    return Promise.resolve();
  },
};

export const maps = {
  get: (lineId) => Promise.resolve(state.maps[String(lineId)] ?? null),
  set: (lineId, payload) => {
    state.maps[String(lineId)] = payload;
    state.updatedAt = nowMs();
    return Promise.resolve();
  },
};

const defaultSettingsAdmin = { theme: "light", companyName: "", companyAbout: "" };
export const settings = {
  get: () =>
    Promise.resolve({
      admin: { ...defaultSettingsAdmin, ...(state.settings?.admin || {}) },
    }),
  set: (next) => {
    const a = next?.admin && typeof next.admin === "object" ? next.admin : {};
    state.settings = {
      admin: {
        theme: a.theme === "dark" ? "dark" : "light",
        companyName: typeof a.companyName === "string" ? a.companyName : "",
        companyAbout: typeof a.companyAbout === "string" ? a.companyAbout : "",
      },
    };
    state.updatedAt = nowMs();
    return Promise.resolve(state.settings);
  },
};
