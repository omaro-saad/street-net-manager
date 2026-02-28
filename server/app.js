import express from "express";
import helmet from "helmet";
import cors from "cors";
import { config } from "./config.js";
import { loginLimiter, apiLimiter } from "./middleware/rateLimit.js";
import authRoutes from "./routes/auth.js";
import apiRoutes from "./routes/api.js";
import dashboardRoutes from "./routes/dashboard.js";
import trackingRoutes from "./routes/tracking.js";

const app = express();

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false, // SPA/API; tighten via reverse proxy in production if needed
  xFrameOptions: { action: "deny" },
  xContentTypeOptions: true,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
}));

const corsOptions = config.allowedOrigins.length
  ? {
      origin: (origin, cb) => {
        if (!origin || config.allowedOrigins.includes(origin)) return cb(null, true);
        return cb(null, false);
      },
      credentials: true,
    }
  : config.nodeEnv === "production"
    ? {
        origin: (origin, cb) => {
          if (!origin) return cb(null, true);
          try {
            if (/\.vercel\.app$/i.test(new URL(origin).hostname)) return cb(null, true);
          } catch {}
          return cb(null, false);
        },
        credentials: true,
      }
    : { origin: true, credentials: true };
app.use(cors(corsOptions));

app.use(express.json({ limit: "2mb" }));

app.get("/favicon.ico", (req, res) => res.status(204).end());
app.get("/", (req, res) =>
  res.json({
    ok: true,
    service: "street-net-manager-api",
    login: "POST /api/auth/login",
    me: "GET /api/auth/me",
    data: "GET/PUT /api/data (Bearer token)",
    health: "GET /health",
  })
);
app.get("/health", (req, res) => {
  const start = Date.now();
  const responseTimeMs = Date.now() - start;
  return res.json({
    ok: true,
    serverUp: true,
    statusText: "ok",
    responseTimeMs,
    lastCheckAt: new Date().toISOString(),
  });
});

app.use("/api", apiLimiter);
app.use("/api/auth", authRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api", trackingRoutes);
app.use("/api", apiRoutes);
app.use((req, res) => {
  const path = `${req.method} ${req.originalUrl || req.url}`;
  console.warn("[404]", path);
  return res.status(404).json({ ok: false, error: "غير موجود.", path });
});
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ ok: false, error: String(err?.message || "خطأ في الخادم.") });
});

export default app;
