// src/tools/generate-license.mjs
import fs from "fs";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";

/**
 * لازم التوقيع والتحقق يستخدموا نفس التمثيل بالضبط (canonicalStringify) في الاثنين.
 */

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

// base64url helpers
function toBase64UrlFromUtf8(str) {
  return Buffer.from(String(str), "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}
function toBase64UrlFromBase64(b64) {
  return String(b64)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}
function makeActivationCode(payloadObj, sigB64) {
  const payloadCanon = canonicalStringify(payloadObj);
  const payloadB64u = toBase64UrlFromUtf8(payloadCanon);
  const sigB64u = toBase64UrlFromBase64(sigB64);
  return `SNM1.${payloadB64u}.${sigB64u}`;
}

// ✅ Paths ثابتة نسبةً لمكان السكربت
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// tools في src/tools => keys في src/keys
const keysDir = path.resolve(__dirname, "..", "keys");
const privPath = path.join(keysDir, "private_ed25519.pem");
const pubPath  = path.join(keysDir, "public_ed25519.pem");

if (!fs.existsSync(privPath)) {
  throw new Error(
    `Missing private key: ${privPath}\n` +
    `Run: node .\\src\\tools\\gen-keys.mjs\n` +
    `IMPORTANT: private key must NEVER be shipped to customers.`
  );
}
if (!fs.existsSync(pubPath)) {
  throw new Error(
    `Missing public key: ${pubPath}\n` +
    `Run: node .\\src\\tools\\gen-keys.mjs`
  );
}

const privateKeyPem = fs.readFileSync(privPath, "utf8");
const publicKeyPem  = fs.readFileSync(pubPath, "utf8");

console.log("=== PUBLIC KEY (APP) ===\n");
console.log(publicKeyPem);

// args
const deviceCode  = process.argv[2] || "PUT_DEVICE_CODE_HERE";
const customerId  = process.argv[3] || "CUSTOMER";
const plan        = process.argv[4] || "lifetime";

const payload = {
  v: 1,
  app: "street-net-manager",
  deviceCode,
  customerId,
  plan,
  features: { inventory: true, finance: true, employees: true },
  issuedAt: Date.now(),
};

// sign
const data = Buffer.from(canonicalStringify(payload), "utf8");
const signature = crypto.sign(null, data, privateKeyPem); // Ed25519

const license = { payload, sig: signature.toString("base64") };

const activationCode = makeActivationCode(license.payload, license.sig);

console.log("\n=== ACTIVATION CODE (send to customer) ===\n");
console.log(activationCode);
console.log("\nDone.");
