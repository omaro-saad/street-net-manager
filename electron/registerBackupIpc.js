// electron/registerBackupIpc.js
const { ipcMain } = require("electron");
const { exportAllDbFiles, importAllDbFiles, resetAllDbFiles } = require("./backupFiles");

function registerBackupIpc() {
  ipcMain.handle("backup:exportAll", async () => {
    // ✅ بدل exportAllDb غير الموجودة
    return await exportAllDbFiles();
  });

  ipcMain.handle("backup:importAll", async (_ev, payload) => {
    // ✅ بدل importAllDb غير الموجودة
    return await importAllDbFiles(payload);
  });

  ipcMain.handle("backup:resetAll", async () => {
    // ✅ بدل resetAllDb غير الموجودة
    return await resetAllDbFiles();
  });
}

module.exports = { registerBackupIpc };
