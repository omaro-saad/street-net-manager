// tools/verify-activation.mjs
import crypto from "crypto";
import fs from "fs";

function fromBase64UrlToBuffer(b64u) {
  const b64 = String(b64u).replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
  return Buffer.from(b64 + pad, "base64");
}

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

const activationCode = process.argv[2];
if (!activationCode) {
  console.error("Usage: node tools/verify-activation.mjs <ACTIVATION_CODE> [publicKeyPath]");
  process.exit(1);
}

const publicKeyPath = process.argv[3] || "./public_ed25519.pem";
if (!fs.existsSync(publicKeyPath)) {
  console.error("Public key file not found:", publicKeyPath);
  process.exit(1);
}

const publicKeyPem = fs.readFileSync(publicKeyPath, "utf8");

// Parse
const parts = String(activationCode).trim().split(".");
if (parts.length !== 3 || parts[0] !== "SNM1") {
  console.error("Bad format. Expected: SNM1.<payload>.<sig>");
  process.exit(1);
}

const payloadB64u = parts[1];
const sigB64u = parts[2];

// Decode payload JSON
const payloadJson = fromBase64UrlToBuffer(payloadB64u).toString("utf8");
let payload;
try {
  payload = JSON.parse(payloadJson);
} catch (e) {
  console.error("Payload JSON parse failed:", e.message);
  console.error("Payload raw:", payloadJson);
  process.exit(1);
}

// Decode signature
const sigBuf = fromBase64UrlToBuffer(sigB64u);

// Canonical stringify (MUST match your generator)
const canon = canonicalStringify(payload);
const data = Buffer.from(canon, "utf8");

// Verify (Ed25519: use null algorithm)
const ok = crypto.verify(null, data, publicKeyPem, sigBuf);

console.log("VERIFY:", ok ? "✅ VALID" : "❌ INVALID");
console.log("payloadCanon:", canon);
console.log("payloadObj:", payload);
console.log("sigLen:", sigBuf.length);
