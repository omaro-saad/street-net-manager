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
const fromList = allowedOriginsRaw
  ? allowedOriginsRaw.split(",").map((o) => o.trim()).filter(Boolean)
  : [];
/** Dashboard app origin (e.g. https://dashboard.example.com). Added to CORS so dashboard can call /api/dashboard/*. */
const dashboardOrigin = (process.env.DASHBOARD_ORIGIN || "").trim();
const allowedOrigins = dashboardOrigin
  ? [...fromList, dashboardOrigin]
  : fromList;

export const config = {
  port: Number(process.env.PORT) || 4000,
  jwtSecret,
  nodeEnv,
  /** CORS: these origins are allowed. Includes DASHBOARD_ORIGIN when set so dashboard can call the API. */
  allowedOrigins,
};
