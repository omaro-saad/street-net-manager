# Deploy frontend + API on Vercel (run once, always on)

On Vercel, the **same project** serves both the static site and the API. You deploy once; the API runs as serverless functions (no bash, no keeping a terminal open).

## What’s in place

- **`api/index.js`** – Entry for Vercel serverless. All `/api/*`, `/health`, and `/favicon.ico` are sent to your Express app.
- **`vercel.json`** – Builds the Vite app and rewrites API/health/favicon to the API.
- **Root `package.json`** – Includes server dependencies (express, helmet, etc.) so Vercel can run the API.

## Required: set environment variables

In the Vercel project: **Settings → Environment Variables**. Add at least:

| Variable | Required | Description |
|----------|----------|-------------|
| **JWT_SECRET** | Yes | Strong secret for auth (e.g. long random string). **Must** be set in production or the API will not start. |
| **SUPABASE_URL** | For DB | Your Supabase project URL (if you use Supabase for accounts/data). |
| **SUPABASE_SERVICE_ROLE_KEY** | For DB | Supabase service role key (keep secret). |

Without **Supabase** variables, the API uses in-memory data that **resets on every cold start** (no persistent users). For a real app, set Supabase (or another hosted DB) and create orgs/users via your CLI/scripts.

Optional:

- **CORS_ALLOWED_ORIGINS** – Comma-separated origins allowed to call the API (e.g. `https://your-site.vercel.app`). If frontend and API are on the same Vercel domain, you can leave this unset.

## Deploy

1. Push the repo (with `api/`, `vercel.json`, and root deps) to Git.
2. In Vercel, import the project (or connect the same repo).
3. Set the env vars above.
4. Deploy. Vercel will:
   - Run `npm run build` → output in `dist`
   - Serve the app from `dist`
   - Route `/api/*`, `/health`, `/favicon.ico` to the Express API

No need to run the server in bash; the API runs on each request.

## Frontend API URL

On Vercel, frontend and API are on the **same domain** (e.g. `https://your-project.vercel.app`). So the app can call `/api/auth/login` etc. with a **relative** URL.

- Either **do not** set `VITE_API_URL` when building on Vercel (so the app uses the same origin),  
- Or set **VITE_API_URL** in Vercel to your production URL, e.g. `https://your-project.vercel.app`, so all API calls go to that origin.

If you leave `VITE_API_URL` unset, the built app will have no API URL unless you inject it. So in Vercel, add:

- **VITE_API_URL** = `https://your-project.vercel.app` (use your real Vercel URL)

so the production build knows where to send API requests (same origin).

## Summary

- One Vercel project = frontend + API.
- Set **JWT_SECRET** (required) and **SUPABASE_*** (for persistent DB).
- Set **VITE_API_URL** to your Vercel URL so login works.
- Deploy once; the “server” runs automatically on Vercel.
