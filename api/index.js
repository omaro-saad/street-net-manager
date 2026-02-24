/**
 * Vercel serverless entry: all /api, /health, /favicon.ico requests are rewritten here.
 * The Express app handles routing; no need to call listen().
 */
import app from "../server/app.js";

export default app;
