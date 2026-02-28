# Vercel serverless entry only

This folder is **not** a separate server. It is the **Vercel serverless entry point** only.

- **Backend:** All logic lives in [`../server/`](../server/). The Express app is in `server/app.js`.
- **This file:** [`index.js`](./index.js) exports that app so Vercel can run it as a serverless function.
- **Routes:** `/api/*`, `/health`, `/favicon.ico` are rewritten to this handler (see root `vercel.json`).

To run the backend locally, use `server/` (e.g. `cd server && npm start`).
