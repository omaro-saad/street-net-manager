// electron/main.mjs
import { app, BrowserWindow, ipcMain, shell, dialog, Menu, session } from "electron";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

// NO DB — All data is in-memory via DataContext

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const APP_NAME_AR = "مدير شبكتك";
const APP_NAME = "street-net-manager";
const BACKUP_BASE = `${APP_NAME}_backup`;

let mainWindow = null;

/* =========================
   Helpers
   ========================= */
function isDev() {
  return Boolean(process.env.VITE_DEV_SERVER_URL);
}

function ensureDir(p) {
  try {
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
  } catch {}
}

function emitChanged(channel) {
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(channel);
    }
  } catch {}
}

function getIndexHtmlPath() {
  return path.join(__dirname, "..", "dist", "index.html");
}

function safeObj(x) {
  return x && typeof x === "object" && !Array.isArray(x) ? x : {};
}
function safeArray(x) {
  return Array.isArray(x) ? x : [];
}
function nowMs() {
  return Date.now();
}
function toErr(e) {
  return String(e?.message || e || "Unknown error");
}
function safeName(x) {
  const s = String(x ?? "").trim() || "untitled";
  return s
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}
function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
}

/* =========================
   Settings (MAIN)
   ========================= */
function getSettingsPath() {
  return path.join(app.getPath("userData"), "settings.json");
}
function readSettings() {
  try {
    const p = getSettingsPath();
    if (!fs.existsSync(p)) return {};
    const raw = fs.readFileSync(p, "utf8");
    const parsed = JSON.parse(raw);
    return safeObj(parsed);
  } catch {
    return {};
  }
}
function writeSettings(next) {
  const clean = safeObj(next);
  const p = getSettingsPath();
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, JSON.stringify(clean, null, 2), "utf8");
  return clean;
}

/* =========================
   Security: disable navigation / new windows
   ========================= */
function attachWebContentsGuards(win) {
  const wc = win.webContents;

  wc.setWindowOpenHandler(({ url }) => {
    try {
      if (url && /^https?:\/\//i.test(url)) shell.openExternal(url);
    } catch {}
    return { action: "deny" };
  });

  wc.on("will-navigate", (e, url) => {
    try {
      if (!url) return;
      if (url.startsWith("file://")) return;
      if (isDev() && url.startsWith(process.env.VITE_DEV_SERVER_URL)) return;
    } catch {}
    e.preventDefault();
  });

  wc.on("before-input-event", (event, input) => {
    const key = String(input.key || "").toLowerCase();
    const ctrl = Boolean(input.control);
    const shift = Boolean(input.shift);
    const alt = Boolean(input.alt);

    if (key === "f5") return event.preventDefault();
    if (ctrl && key === "r") return event.preventDefault();
    if (ctrl && shift && key === "r") return event.preventDefault();

    if (key === "f12") return event.preventDefault();
    if (ctrl && shift && (key === "i" || key === "j")) return event.preventDefault();

    if (ctrl && key === "w") return event.preventDefault();

    if (alt && (key === "arrowleft" || key === "arrowright")) return event.preventDefault();
  });

  wc.on("devtools-opened", () => {
    try {
      wc.closeDevTools();
    } catch {}
  });
}

function applyBasicCsp() {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const headers = details.responseHeaders || {};
    if (isDev()) return callback({ responseHeaders: headers });

    // connect-src: 'self' + API origins so login/data work when app is file:// or loaded from dev
    const csp = [
      "default-src 'self'",
      "img-src 'self' data: blob:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self'",
      "connect-src 'self' https: http://localhost:* http://127.0.0.1:*",
      "font-src 'self' data:",
      "object-src 'none'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "form-action 'self'",
    ].join("; ");

    headers["Content-Security-Policy"] = [csp];
    callback({ responseHeaders: headers });
  });
}

/* =========================
   Window
   ========================= */
function createWindow() {
  try {
    app.setName(APP_NAME_AR);
  } catch {}

  const iconPath = isDev()
  ? path.join(__dirname, "..", "src", "assets", "Icon.ico")
  : path.join(__dirname, "..", "dist", "assets", "Icon.ico"); // إذا بتنسخه للـ dist


  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: true,
    autoHideMenuBar: true,
    icon: iconPath,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
      devTools: false,
      webSecurity: true,
      sandbox: true,
    },
  });

  try {
    Menu.setApplicationMenu(null);
    mainWindow.setMenuBarVisibility(false);
  } catch {}

  attachWebContentsGuards(mainWindow);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame) return;
    console.error("[did-fail-load]", { errorCode, errorDescription, validatedURL });
  });

  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    console.error("[render-process-gone]", details);
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) mainWindow.loadURL(devUrl);
  else mainWindow.loadFile(getIndexHtmlPath());
}

/* =========================
   Export (تحميل الخط)
   ========================= */
async function exportLineFolder(payload) {
  const p = safeObj(payload);
  const line = safeObj(p.line);
  const sections = safeObj(p.sections);

  const lineId = String(line.id ?? "").trim();
  const lineName = safeName(line.name || lineId || "line");

  const downloads = app.getPath("downloads");
  const outBase = path.join(downloads, "StreetNet_Exports");
  ensureDir(outBase);

  const folderName = `${lineName}__${safeName(lineId || "noid")}__${stamp()}`;
  const outDir = path.join(outBase, folderName);
  ensureDir(outDir);

  const outJson = {
    meta: { app: APP_NAME, exportedAt: nowMs(), folderName, outDir },
    line: {
      id: lineId,
      name: String(line.name ?? ""),
      address: String(line.address ?? ""),
      active: Boolean(line.active),
    },
    subscribers: safeArray(sections.subscribers),
    distributors: safeArray(sections.distributors),
  };

  const jsonPath = path.join(outDir, "line_export.json");
  const readmePath = path.join(outDir, "README.txt");

  fs.writeFileSync(jsonPath, JSON.stringify(outJson, null, 2), "utf8");
  fs.writeFileSync(
    readmePath,
    [
      "Street Net Manager - Line Export",
      `Export time: ${new Date().toLocaleString()}`,
      `Line: ${lineName}`,
      `Line ID: ${lineId || "—"}`,
      "",
      "Files:",
      "- line_export.json",
      "- README.txt",
      "",
      `Folder: ${outDir}`,
    ].join("\n"),
    "utf8"
  );

  try {
    await shell.openPath(outDir);
  } catch {}

  return { ok: true, outDir, folderName, files: ["line_export.json", "README.txt"] };
}

/* =========================
   Backup engine
   ========================= */
const BACKUP_PAGES = ["settings", "subscribers", "distributors", "lines", "maps", "inventory", "finance", "employees", "packages"];

async function exportPage(key) {
  switch (key) {
    case "settings":
      return { value: readSettings() };
    default:
      return { items: [], kv: {} };
  }
}

async function resetPage(key) {
  switch (key) {
    case "settings":
      writeSettings({});
      emitChanged("settings:changed");
      return true;
    default:
      return true;
  }
}

async function importPage(key, payload) {
  switch (key) {
    case "settings": {
      const v = safeObj(payload?.value ?? payload);
      writeSettings(v);
      emitChanged("settings:changed");
      return true;
    }
    default:
      return true;
  }
}

async function backupExportAll() {
  const pages = [...BACKUP_PAGES];
  const out = {};
  const report = { ok: true, doneAt: nowMs(), pages: {} };

  for (const key of pages) {
    try {
      out[key] = safeObj(await exportPage(key));
      report.pages[key] = { ok: true };
    } catch (e) {
      out[key] = { __error: toErr(e) };
      report.ok = false;
      report.pages[key] = { ok: false, error: toErr(e) };
    }
  }

  return { meta: { app: APP_NAME, version: "backup_v2_main", exportedAt: nowMs(), pages }, pages: out, report };
}

async function backupResetAll() {
  const pages = ["settings", "lines", "maps", "subscribers", "distributors", "inventory", "finance", "employees", "packages"];
  const report = { ok: true, doneAt: nowMs(), pages: {} };

  for (const key of pages) {
    try {
      await resetPage(key);
      report.pages[key] = { ok: true };
    } catch (e) {
      report.ok = false;
      report.pages[key] = { ok: false, error: toErr(e) };
    }
  }

  return { ok: report.ok, resetAt: nowMs(), pagesReset: pages, report };
}

async function backupImportAll(payload) {
  const p = safeObj(payload);
  const pagesPayload = safeObj(p.pages);

  const rawSize = Buffer.byteLength(JSON.stringify(payload ?? {}), "utf8");
  const MAX_BYTES = 15 * 1024 * 1024;
  if (rawSize > MAX_BYTES) throw new Error(`Backup payload too large: ${rawSize} bytes (max ${MAX_BYTES})`);

  const order = ["settings", "lines", "maps", "subscribers", "distributors", "inventory", "finance", "employees", "packages"];
  const report = { ok: true, doneAt: nowMs(), pages: {} };

  for (const key of order) {
    const slice = pagesPayload[key];
    if (slice == null) {
      report.pages[key] = { ok: true, skipped: true, reason: "NO_PAYLOAD" };
      continue;
    }
    try {
      await importPage(key, slice);
      report.pages[key] = { ok: true };
    } catch (e) {
      report.ok = false;
      report.pages[key] = { ok: false, error: toErr(e) };
    }
  }

  return { ok: report.ok, importedAt: nowMs(), pagesImported: order, report };
}

/* =========================
   Backup: SaveAs / PickRestore / AutoBackup
   ========================= */
function getAutoBackupDir() {
  const downloads = app.getPath("downloads");
  const dir = path.join(downloads, "StreetNet_Backups", "Auto");
  ensureDir(dir);
  return dir;
}

function cleanupOldAutoBackups(dir, keep = 20) {
  try {
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => {
        const full = path.join(dir, f);
        const st = fs.statSync(full);
        return { f, full, t: st.mtimeMs || 0 };
      })
      .sort((a, b) => b.t - a.t);

    const extra = files.slice(keep);
    for (const it of extra) {
      try {
        fs.unlinkSync(it.full);
      } catch {}
    }
  } catch {}
}

async function runAutoBackupOnStartup() {
  try {
    const payload = await backupExportAll();
    const dir = getAutoBackupDir();
    const fileName = `${BACKUP_BASE}_تلقائي_${stamp()}.json`;
    const outPath = path.join(dir, fileName);

    fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
    cleanupOldAutoBackups(dir, 20);
    return { ok: true, outPath };
  } catch (e) {
    console.error("[AUTO_BACKUP_FAILED]", toErr(e));
    return { ok: false, error: toErr(e) };
  }
}

async function backupSaveJsonAs(_payload, suggestedName) {
  const payload = safeObj(_payload);
  const suggested = safeName(suggestedName || `${BACKUP_BASE}_يدوي_${stamp()}.json`);
  const defaultPath = path.join(app.getPath("downloads"), suggested);

  const res = await dialog.showSaveDialog(mainWindow, {
    title: "حفظ نسخة احتياطية",
    defaultPath,
    filters: [{ name: "Backup JSON", extensions: ["json"] }],
  });

  if (res.canceled || !res.filePath) return { ok: false, canceled: true };
  fs.writeFileSync(res.filePath, JSON.stringify(payload, null, 2), "utf8");
  return { ok: true, path: res.filePath };
}

async function backupPickAndImport() {
  const res = await dialog.showOpenDialog(mainWindow, {
    title: "اختر ملف النسخة الاحتياطية",
    properties: ["openFile"],
    filters: [{ name: "Backup JSON", extensions: ["json"] }],
  });

  if (res.canceled || !res.filePaths?.[0]) return { ok: false, canceled: true };

  const filePath = res.filePaths[0];
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw);

  const result = await backupImportAll(parsed);
  return { ok: true, filePath, result };
}

/* =========================
   IPC register
   ========================= */
let IPC_REGISTERED = false;
function registerIpcOnce() {
  if (IPC_REGISTERED) return;
  IPC_REGISTERED = true;

  // ✅ DEV-SAFE: clean old handlers
  const resetHandlers = ["app:ping"];
  for (const ch of resetHandlers) {
    try {
      ipcMain.removeHandler(ch);
    } catch {}
  }

  ipcMain.handle("app:ping", async () => "pong");

  // ===== No DB — data is in-memory via DataContext =====
  // Stub IPC handlers (renderer uses DataContext, these are unused)
  ipcMain.handle("subscribers:list", async () => []);
  ipcMain.handle("subscribers:add", async (_e, row) => row);
  ipcMain.handle("subscribers:update", async () => ({ ok: true }));
  ipcMain.handle("subscribers:remove", async () => ({ ok: true }));

  ipcMain.handle("distributors:list", async () => []);
  ipcMain.handle("distributors:add", async (_e, row) => row);
  ipcMain.handle("distributors:update", async () => ({ ok: true }));
  ipcMain.handle("distributors:remove", async () => ({ ok: true }));

  ipcMain.handle("lines:list", async () => []);
  ipcMain.handle("lines:add", async (_e, row) => row);
  ipcMain.handle("lines:update", async () => ({ ok: true }));
  ipcMain.handle("lines:remove", async () => ({ ok: true }));

  ipcMain.handle("maps:get", async () => null);
  ipcMain.handle("maps:save", async () => ({ ok: true }));
  ipcMain.handle("maps:clear", async () => ({ ok: true }));
  ipcMain.handle("maps:list", async () => []);

  ipcMain.handle("inventory:listAll", async () => ({ warehouses: [], sections: [], items: [] }));
  ipcMain.handle("inventory:warehouse:create", async () => ({ ok: true }));
  ipcMain.handle("inventory:warehouse:delete", async () => ({ ok: true }));
  ipcMain.handle("inventory:section:create", async () => ({ ok: true }));
  ipcMain.handle("inventory:section:delete", async () => ({ ok: true }));
  ipcMain.handle("inventory:item:create", async () => ({ ok: true }));
  ipcMain.handle("inventory:item:update", async () => ({ ok: true }));
  ipcMain.handle("inventory:item:delete", async () => ({ ok: true }));

  ipcMain.handle("packages:list", async () => []);
  ipcMain.handle("packages:getById", async () => null);
  ipcMain.handle("packages:upsert", async (_e, row) => row);
  ipcMain.handle("packages:remove", async () => ({ ok: true }));
  ipcMain.handle("packages:clearAll", async () => ({ ok: true }));

  ipcMain.handle("finance:get", async () => undefined);
  ipcMain.handle("finance:set", async () => ({ ok: true }));
  ipcMain.handle("finance:deleteKey", async () => ({ ok: true }));
  ipcMain.handle("finance:listAll", async () => ({}));
  ipcMain.handle("finance:resetAll", async () => ({ ok: true }));
  ipcMain.handle("finance:appendAutoInvoice", async (_e, x) => (x ? { ok: true } : { ok: false }));

  ipcMain.handle("employees:list", async () => []);
  ipcMain.handle("employees:getById", async () => null);
  ipcMain.handle("employees:add", async (_e, row) => row);
  ipcMain.handle("employees:update", async () => ({ ok: true }));
  ipcMain.handle("employees:remove", async () => ({ ok: true }));
  ipcMain.handle("employees:resetAll", async () => ({ ok: true }));

  // Settings IPC
  ipcMain.handle("settings:get", async () => readSettings());
  ipcMain.handle("settings:set", async (_e, payload) => {
    const saved = writeSettings(payload);
    emitChanged("settings:changed");
    return saved;
  });

  // ✅ Export IPC
  ipcMain.handle("export:lineFolder", async (_e, payload) => exportLineFolder(payload));

  // ✅ Backup IPC
  ipcMain.handle("backup:listPages", async () => [...BACKUP_PAGES]);
  ipcMain.handle("backup:exportAll", async () => backupExportAll());
  ipcMain.handle("backup:resetAll", async () => backupResetAll());
  ipcMain.handle("backup:importAll", async (_e, payload) => backupImportAll(payload));
  ipcMain.handle("backup:saveJsonAs", async (_e, payload, suggestedName) => backupSaveJsonAs(payload, suggestedName));
  ipcMain.handle("backup:pickAndImport", async () => backupPickAndImport());
}

/* =========================
   Single Instance
   ========================= */
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    try {
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
      }
    } catch {}
  });

  app.whenReady().then(async () => {
    registerIpcOnce();
    applyBasicCsp();

    await runAutoBackupOnStartup();
    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
