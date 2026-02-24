/**
 * Server config from env. Use .env file (see .env.example).
 */
import dotenv from "dotenv";

dotenv.config();

const defaultJwtSecret = "dev-secret-change-in-production";
const nodeEnv = process.env.NODE_ENV || "development";
const jwtSecret = process.env.JWT_SECRET || defaultJwtSecret;

if (nodeEnv === "production" && jwtSecret === defaultJwtSecret) {
  console.error("[SECURITY] Set JWT_SECRET in production. Refusing to start.");
  process.exit(1);
}

/** Comma-separated origins for CORS, or empty to allow same-origin only. Example: https://app.example.com,https://admin.example.com */
const allowedOriginsRaw = process.env.CORS_ALLOWED_ORIGINS || "";
const allowedOrigins = allowedOriginsRaw
  ? allowedOriginsRaw.split(",").map((o) => o.trim()).filter(Boolean)
  : [];

export const config = {
  port: Number(process.env.PORT) || 3000,
  jwtSecret,
  nodeEnv,
  /** If empty, CORS will allow same-origin only in production; in dev, allow common dev origins. */
  allowedOrigins,
};
