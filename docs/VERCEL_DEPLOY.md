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

## What to do after setting environment variables

1. **Redeploy** so the new env vars are used:
   - **Vercel dashboard** → your project → **Deployments** → open the **⋯** on the latest deployment → **Redeploy** (or push a new commit to the connected branch).
2. Wait for the build to finish. Vercel will:
   - Run `npm run build` → output in `dist`
   - Serve the frontend from `dist`
   - Route `/api/*`, `/health`, `/favicon.ico` to the Express API (serverless)
3. Open your site URL (e.g. `https://your-project.vercel.app`). Frontend and API are on the same domain; no extra setup.

You do **not** need to set Build Command, Output Directory, or Install Command in Vercel — `vercel.json` already configures the build.

## Deploy (first time or new repo)

1. Push the repo (with `api/`, `vercel.json`, and root deps) to Git.
2. In Vercel: **Add New** → **Project** → import from Git (GitHub/GitLab/Bitbucket).
3. Set the env vars above in **Settings → Environment Variables**.
4. Click **Deploy**. After the first deploy, every push to the connected branch will auto-deploy.

## Frontend API URL (no need on Vercel)

On Vercel, frontend and API are on the **same deployment URL**. The app uses **relative** URLs (`/api/...`) when `VITE_API_URL` is not set and it’s running in the browser, so you **do not need** to set `VITE_API_URL` in Vercel. That avoids CORS and works with every preview URL.

If you host the frontend elsewhere and call this API from another domain, set **CORS_ALLOWED_ORIGINS** to that origin and set **VITE_API_URL** in that frontend’s build to this API URL.

## Summary

- One Vercel project = frontend + API.
- Set **JWT_SECRET** (required) and **SUPABASE_*** (for persistent DB).
- Do **not** set **VITE_API_URL** — the app uses the same origin on Vercel.
- Deploy once; the “server” runs automatically on Vercel.
