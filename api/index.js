/**
 * Vercel serverless entry only. All /api, /health, /favicon.ico are rewritten here.
 * The real backend is server/app.js — this file just exports it (no duplicate server).
 */
import app from "../server/app.js";

export default app;
