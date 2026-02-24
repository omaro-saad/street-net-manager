// electron/preload.cjs
const { contextBridge, ipcRenderer } = require("electron");

async function invokeSafe(channel, ...args) {
  try {
    return await ipcRenderer.invoke(channel, ...args);
  } catch (e) {
    const msg = String(e?.message || e || "");
    throw new Error(`[IPC:${channel}] ${msg}`);
  }
}

function makeOnChanged(channel) {
  return (cb) => {
    if (typeof cb !== "function") return () => {};
    const handler = () => cb();
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  };
}

const api = Object.freeze({
  isElectron: true,
  ping: () => invokeSafe("app:ping"),

  settings: {
    get: () => invokeSafe("settings:get"),
    set: (payload) => invokeSafe("settings:set", payload),
    onChanged: makeOnChanged("settings:changed"),
  },

  subscribers: {
    list: () => invokeSafe("subscribers:list"),
    add: (row) => invokeSafe("subscribers:add", row),
    update: (id, patch) => invokeSafe("subscribers:update", id, patch),
    remove: (id) => invokeSafe("subscribers:remove", id),
    onChanged: makeOnChanged("subscribers:changed"),
  },

  distributors: {
    list: () => invokeSafe("distributors:list"),
    add: (row) => invokeSafe("distributors:add", row),
    update: (id, patch) => invokeSafe("distributors:update", id, patch),
    remove: (id) => invokeSafe("distributors:remove", id),
    onChanged: makeOnChanged("distributors:changed"),
  },

  lines: {
    list: () => invokeSafe("lines:list"),
    add: (row) => invokeSafe("lines:add", row),
    update: (id, patch) => invokeSafe("lines:update", id, patch),
    remove: (id) => invokeSafe("lines:remove", id),
    onChanged: makeOnChanged("lines:changed"),
  },

  inventory: {
    listAll: () => invokeSafe("inventory:listAll"),
    onChanged: makeOnChanged("inventory:changed"),
    warehouse: {
      create: (payload) => invokeSafe("inventory:warehouse:create", payload),
      delete: (id) => invokeSafe("inventory:warehouse:delete", id),
    },
    section: {
      create: (payload) => invokeSafe("inventory:section:create", payload),
      delete: (id) => invokeSafe("inventory:section:delete", id),
    },
    item: {
      create: (payload) => invokeSafe("inventory:item:create", payload),
      update: (payload) => invokeSafe("inventory:item:update", payload),
      delete: (id) => invokeSafe("inventory:item:delete", id),
    },
  },

  finance: {
    get: (key) => invokeSafe("finance:get", key),
    set: (key, value) => invokeSafe("finance:set", key, value),
    deleteKey: (key) => invokeSafe("finance:deleteKey", key),
    listAll: () => invokeSafe("finance:listAll"),
    resetAll: () => invokeSafe("finance:resetAll"),
    appendAutoInvoice: (row) => invokeSafe("finance:appendAutoInvoice", row),
    onChanged: makeOnChanged("finance:changed"),
  },

  employees: {
    list: () => invokeSafe("employees:list"),
    getById: (id) => invokeSafe("employees:getById", id),
    add: (row) => invokeSafe("employees:add", row),
    update: (id, patch) => invokeSafe("employees:update", id, patch),
    remove: (id) => invokeSafe("employees:remove", id),
    resetAll: () => invokeSafe("employees:resetAll"),
    onChanged: makeOnChanged("employees:changed"),
  },

  maps: {
    get: (lineId) => invokeSafe("maps:get", lineId),
    save: (lineId, payload) => invokeSafe("maps:save", lineId, payload),
    clear: (lineId) => invokeSafe("maps:clear", lineId),
    list: () => invokeSafe("maps:list"),
    onChanged: makeOnChanged("maps:changed"),
  },

  packages: {
    list: () => invokeSafe("packages:list"),
    getById: (id) => invokeSafe("packages:getById", id),
    upsert: (row) => invokeSafe("packages:upsert", row),
    remove: (id) => invokeSafe("packages:remove", id),
    clearAll: () => invokeSafe("packages:clearAll"),
    onChanged: makeOnChanged("packages:changed"),
  },

  export: {
    lineFolder: (payload) => invokeSafe("export:lineFolder", payload),
  },

  backup: {
    listPages: () => invokeSafe("backup:listPages"),
    exportAll: () => invokeSafe("backup:exportAll"),
    importAll: (payload) => invokeSafe("backup:importAll", payload),
    resetAll: () => invokeSafe("backup:resetAll"),
    saveJsonAs: (payload, suggestedName) => invokeSafe("backup:saveJsonAs", payload, suggestedName),
    pickAndImport: () => invokeSafe("backup:pickAndImport"),
  },
});

contextBridge.exposeInMainWorld("api", api);
