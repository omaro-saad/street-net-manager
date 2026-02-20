// src/tools/gen-keys.mjs
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// tools موجودة في: src/tools
// keys بدنا إياها في: src/keys
const keysDir = path.resolve(__dirname, "..", "keys");
fs.mkdirSync(keysDir, { recursive: true });

const privPath = path.join(keysDir, "private_ed25519.pem");
const pubPath = path.join(keysDir, "public_ed25519.pem");

const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");

fs.writeFileSync(pubPath, publicKey.export({ type: "spki", format: "pem" }), "utf8");
fs.writeFileSync(privPath, privateKey.export({ type: "pkcs8", format: "pem" }), "utf8");

console.log("✅ Generated keys:");
console.log("PUBLIC :", pubPath);
console.log("PRIVATE:", privPath);
console.log("\n🚫 IMPORTANT: Never ship the PRIVATE key to customers.");
