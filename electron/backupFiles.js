// electron/backupFiles.js
const fs = require("fs");
const path = require("path");
const { app } = require("electron");

// الملفات اللي غالباً تمثل قاعدة البيانات/تخزينك الحقيقي
const ALLOW_FILE = (name) => {
  const n = name.toLowerCase();
  return (
    n.endsWith(".db") ||
    n.endsWith(".sqlite") ||
    n.endsWith(".sqlite3") ||
    n.endsWith(".json") ||
    n.endsWith(".dat")
  );
};

// استثناءات مهمة عشان ما ننسخ cache ضخم
const SKIP_DIR = (dirName) => {
  const d = dirName.toLowerCase();
  return (
    d.includes("cache") ||
    d.includes("code cache") ||
    d.includes("gpuCache".toLowerCase()) ||
    d.includes("logs") ||
    d.includes("crashpad") ||
    d.includes("shadercache")
  );
};

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;

  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const it of items) {
    const full = path.join(dir, it.name);

    if (it.isDirectory()) {
      if (SKIP_DIR(it.name)) continue;
      walk(full, out);
      continue;
    }

    if (!it.isFile()) continue;
    if (!ALLOW_FILE(it.name)) continue;

    out.push(full);
  }
  return out;
}

function readFileSmart(filePath) {
  const buf = fs.readFileSync(filePath);
  // حاول نعتبره نص لو كان json، غير هيك نخليه base64
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".json")) {
    return { encoding: "utf8", data: buf.toString("utf8") };
  }
  return { encoding: "base64", data: buf.toString("base64") };
}

function writeFileSmart(filePath, payload) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });

  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid file payload");
  }

  if (payload.encoding === "utf8") {
    fs.writeFileSync(filePath, String(payload.data ?? ""), "utf8");
    return;
  }

  if (payload.encoding === "base64") {
    const b = Buffer.from(String(payload.data ?? ""), "base64");
    fs.writeFileSync(filePath, b);
    return;
  }

  throw new Error(`Unknown encoding: ${payload.encoding}`);
}

async function exportAllDbFiles() {
  const userData = app.getPath("userData");
  const files = walk(userData);

  const packed = files.map((abs) => {
    const rel = path.relative(userData, abs);
    const stat = fs.statSync(abs);
    const content = readFileSmart(abs);
    return {
      relPath: rel.replace(/\\/g, "/"),
      size: stat.size,
      mtimeMs: stat.mtimeMs,
      ...content,
    };
  });

  return {
    meta: {
      kind: "userData-db-files",
      exportedAt: Date.now(),
    },
    files: packed,
  };
}

async function importAllDbFiles(dbPayload) {
  const userData = app.getPath("userData");

  if (!dbPayload || typeof dbPayload !== "object") {
    throw new Error("Invalid backup payload");
  }

  const files = Array.isArray(dbPayload.files) ? dbPayload.files : [];
  if (!files.length) {
    // لو ما فيه ملفات، نعتبرها OK (يمكن المستخدم عامل backup بدون DB)
    return { ok: true, restored: 0 };
  }

  let restored = 0;
  for (const f of files) {
    const rel = String(f.relPath || "").replace(/\\/g, "/");
    if (!rel) continue;

    // حماية: امنع المسارات الغريبة
    if (rel.includes("..")) continue;

    const abs = path.join(userData, rel);
    writeFileSmart(abs, f);
    restored++;
  }

  return { ok: true, restored };
}

async function resetAllDbFiles() {
  const userData = app.getPath("userData");
  const files = walk(userData);

  let deleted = 0;
  for (const abs of files) {
    try {
      fs.unlinkSync(abs);
      deleted++;
    } catch (_) {}
  }

  return { ok: true, deleted };
}

module.exports = {
  exportAllDbFiles,
  importAllDbFiles,
  resetAllDbFiles,
};
