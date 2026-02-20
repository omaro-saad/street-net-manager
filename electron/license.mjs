// electron/license.mjs
import fs from "fs";
import path from "path";
import crypto from "crypto";
import si from "systeminformation";
import machineIdPkg from "node-machine-id";
const { machineIdSync } = machineIdPkg;

/**
 * Public key (Ed25519) PEM (SPKI)
 * Put YOUR public key here (generated offline).
 */
export const PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEA5Z8ypEjIl2EqRfFTozAYTdVajFo3dv8PkLZqEx5MS/4=
-----END PUBLIC KEY-----`;

const APP_SALT = "street-net-manager::salt::v1";
const ACTIVATION_FILE = "activation.dat";

/* -----------------------
   Helpers
   ----------------------- */
function normStr(x) {
  return String(x ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function sha256(s) {
  return crypto.createHash("sha256").update(String(s)).digest("hex");
}

function safeObj(x) {
  return x && typeof x === "object" && !Array.isArray(x) ? x : {};
}

/* -----------------------
   Fingerprint (stable-ish)
   signals: mid, sys, board, disk
   deviceCode uses: mid + sys + board
   ----------------------- */
export async function getFingerprintSignals() {
  // 1) machine id (stable)
  let midRaw = "";
  try {
    midRaw = machineIdSync(false); // raw
  } catch {
    midRaw = "";
  }

  // 2) system uuid / serial
  let sysRaw = "";
  try {
    const sys = await si.system();
    sysRaw = normStr(sys.uuid || sys.serial || sys.sku || "");
  } catch {
    sysRaw = "";
  }

  // 3) baseboard serial
  let boardRaw = "";
  try {
    const bb = await si.baseboard();
    boardRaw = normStr(bb.serial || bb.assetTag || bb.model || "");
  } catch {
    boardRaw = "";
  }

  // 4) disk (best effort only)
  let diskRaw = "";
  try {
    const disks = await si.diskLayout();
    const d0 = disks?.[0];
    diskRaw = normStr(d0?.serialNum || d0?.name || d0?.device || "");
  } catch {
    diskRaw = "";
  }

  return {
    mid: midRaw ? sha256(midRaw) : "",
    sys: sysRaw ? sha256(sysRaw) : "",
    board: boardRaw ? sha256(boardRaw) : "",
    disk: diskRaw ? sha256(diskRaw) : "",
  };
}

export async function getDeviceCode() {
  const s = await getFingerprintSignals();
  const core = `${s.mid}.${s.sys}.${s.board}`;
  const raw = crypto.createHash("sha256").update(core).digest();
  return raw.toString("base64url").slice(0, 22).toUpperCase();
}

/* -----------------------
   Activation storage (AES-256-GCM)
   key derived from signals
   ----------------------- */
function deriveKeyFromSignals(signals) {
  const m = `${signals.mid}|${signals.sys}|${signals.board}|${signals.disk}`;
  return crypto.scryptSync(m, APP_SALT, 32);
}

function aesGcmEncrypt(key32, jsonObj) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key32, iv);
  const pt = Buffer.from(JSON.stringify(jsonObj), "utf8");
  const ct = Buffer.concat([cipher.update(pt), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString("base64");
}

function aesGcmDecrypt(key32, b64) {
  const buf = Buffer.from(String(b64), "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key32, iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return JSON.parse(pt.toString("utf8"));
}

/* -----------------------
   Verify signature (Ed25519)
   IMPORTANT: payload string must match what you signed.
   If your generator uses canonicalStringify, do the same here.
   ----------------------- */
function canonicalStringify(obj) {
  const seen = new WeakSet();
  const sorter = (v) => {
    if (v === null || typeof v !== "object") return v;
    if (seen.has(v)) throw new Error("CIRCULAR_JSON");
    seen.add(v);
    if (Array.isArray(v)) return v.map(sorter);
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = sorter(v[k]);
    return out;
  };
  return JSON.stringify(sorter(obj));
}

export function verifySignedLicense(licenseObj) {
  if (!licenseObj || typeof licenseObj !== "object")
    return { ok: false, error: "INVALID_LICENSE_OBJ" };

  const payload = safeObj(licenseObj.payload);
  const sigB64 = licenseObj.sig;

  if (!payload || Object.keys(payload).length === 0) return { ok: false, error: "NO_PAYLOAD" };
  if (!sigB64) return { ok: false, error: "NO_SIG" };

  let pub;
  try {
    pub = crypto.createPublicKey(PUBLIC_KEY_PEM);
  } catch {
    return { ok: false, error: "BAD_PUBLIC_KEY_PEM" };
  }

  // MUST match generator: canonicalStringify(payload)
  const data = Buffer.from(canonicalStringify(payload), "utf8");

  let sig;
  try {
    sig = Buffer.from(String(sigB64), "base64");
  } catch {
    return { ok: false, error: "BAD_SIG_BASE64" };
  }

  const ok = crypto.verify(null, data, pub, sig);
  if (!ok) return { ok: false, error: "BAD_SIGNATURE" };

  return { ok: true, payload };
}

/* -----------------------
   Matching policy: 2 of 4
   ----------------------- */
function countMatches(a, b) {
  const keys = ["mid", "sys", "board", "disk"];
  let same = 0;
  const details = {};
  for (const k of keys) {
    const eq = a?.[k] && b?.[k] && String(a[k]) === String(b[k]);
    details[k] = !!eq;
    if (eq) same++;
  }
  return { same, details };
}

/* -----------------------
   Activation file helpers
   ----------------------- */
export function activationPath(appUserDataPath) {
  return path.join(appUserDataPath, ACTIVATION_FILE);
}

export async function readActivation(appUserDataPath) {
  const p = activationPath(appUserDataPath);
  if (!fs.existsSync(p)) return null;

  const b64 = fs.readFileSync(p, "utf8");
  const nowSignals = await getFingerprintSignals();
  const key = deriveKeyFromSignals(nowSignals);

  try {
    return aesGcmDecrypt(key, b64);
  } catch {
    return null;
  }
}

export async function writeActivation(appUserDataPath, activationObj) {
  const p = activationPath(appUserDataPath);
  const nowSignals = await getFingerprintSignals();
  const key = deriveKeyFromSignals(nowSignals);
  const b64 = aesGcmEncrypt(key, activationObj);

  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, b64, "utf8");
  return true;
}

/* -----------------------
   ✅ NEW: clear activation (logout)
   ----------------------- */
export function clearActivation(appUserDataPath) {
  const p = activationPath(appUserDataPath);
  try {
    if (fs.existsSync(p)) fs.unlinkSync(p);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}

/* -----------------------
   Main flows (EXPORTED)
   ----------------------- */
export async function checkActivation(appUserDataPath) {
  const act = await readActivation(appUserDataPath);
  if (!act) return { ok: false, reason: "NO_ACTIVATION" };

  const current = await getFingerprintSignals();
  const snap = act?.signals;
  const { same, details } = countMatches(snap, current);

  if (same >= 2) return { ok: true, same, details, plan: act?.plan || "lifetime" };
  return { ok: false, reason: "FINGERPRINT_MISMATCH", same, details };
}

export async function activateWithLicense(appUserDataPath, licenseObj) {
  const v = verifySignedLicense(licenseObj);
  if (!v.ok) return v;

  const payload = v.payload;

  const deviceCodeNow = await getDeviceCode();
  if (payload.deviceCode && String(payload.deviceCode) !== String(deviceCodeNow)) {
    return { ok: false, error: "DEVICE_CODE_NOT_MATCH" };
  }

  const signals = await getFingerprintSignals();
  const activation = {
    activatedAt: Date.now(),
    customerId: payload.customerId || "",
    plan: payload.plan || "lifetime",
    features: payload.features || {},
    signals,
    payload,
  };

  await writeActivation(appUserDataPath, activation);
  return { ok: true, plan: activation.plan };
}
