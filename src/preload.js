// src/preload.js
const { contextBridge, ipcRenderer } = require("electron");

function makeOnChanged(channel) {
  return (cb) => {
    if (typeof cb !== "function") return () => {};
    const handler = () => cb();
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  };
}

async function invokeSafe(channel, ...args) {
  try {
    return await ipcRenderer.invoke(channel, ...args);
  } catch (e) {
    const msg = String(e?.message || e || "");
    throw new Error(`[IPC:${channel}] ${msg}`);
  }
}

contextBridge.exposeInMainWorld("api", {
  // معلومات سريعة
  ping: () => invokeSafe("app:ping"),
  isElectron: true,

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

  lineDevices: {
    listAll: () => invokeSafe("lineDevices:listAll"),
    listByLineId: (lineId) => invokeSafe("lineDevices:listByLineId", lineId),
    add: (row) => invokeSafe("lineDevices:add", row),
    update: (id, patch) => invokeSafe("lineDevices:update", id, patch),
    remove: (id) => invokeSafe("lineDevices:remove", id),
    onChanged: makeOnChanged("lineDevices:changed"),
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

  // ✅✅✅ FINANCE API (DB)
  // ملاحظة: أضفنا meta helper فقط (لا يحتاج أي تغيير بالـ main process)
  finance: {
    listAll: () => invokeSafe("finance:listAll"),
    listByType: (type) => invokeSafe("finance:listByType", type),
    getById: (id) => invokeSafe("finance:getById", id),
    upsert: (row) => invokeSafe("finance:upsert", row),
    remove: (id) => invokeSafe("finance:remove", id),
    resetAll: () => invokeSafe("finance:resetAll"),
    onChanged: makeOnChanged("finance:changed"),

    // ✅ meta row ثابت نستخدمه لتخزين pricing + autoRunKeys بشكل مركزي
    meta: {
      get: () => invokeSafe("finance:getById", "finance_meta"),
      set: (payload) => invokeSafe("finance:upsert", { id: "finance_meta", type: "meta", ...payload }),
    },
  },

  // ✅✅✅ BACKUP API
  backup: {
    exportAll: () => invokeSafe("backup:exportAll"),
    importAll: (payload) => invokeSafe("backup:importAll", payload),
    resetAll: () => invokeSafe("backup:resetAll"),
  },

  export: {
    lineFolder: (payload) => invokeSafe("export:lineFolder", payload),
  },
});
