// src/backup/registerPage.js

function safeObj(x) {
    return x && typeof x === "object" && !Array.isArray(x) ? x : {};
  }
  
  export function registerPage(pageKey, handlers) {
    const api = window?.api;
    const sc = api?.settingsControl;
  
    // إذا مش داخل Electron / preload مش شغال: نرجّع unsubscriber فاضي بدون كراش
    if (!sc || typeof sc.register !== "function") {
      return () => {};
    }
  
    const key = String(pageKey || "").trim();
    if (!key) return () => {};
  
    const h = safeObj(handlers);
    if (typeof h.export !== "function") throw new Error(`registerPage(${key}): export() required`);
    if (typeof h.import !== "function") throw new Error(`registerPage(${key}): import() required`);
    if (typeof h.reset !== "function") throw new Error(`registerPage(${key}): reset() required`);
  
    sc.register(key, {
      export: h.export,
      import: h.import,
      reset: h.reset,
    });
  
    // cleanup
    return () => {
      try {
        sc.unregister(key);
      } catch (_) {}
    };
  }
  