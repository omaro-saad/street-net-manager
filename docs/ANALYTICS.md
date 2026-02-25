# Analytics and visitor count

## Current: total visitors

- **How it works:** When someone opens your site (Street Net Manager app), the frontend calls `GET /api/track-visit` once per browser session. The API increments a counter. The **dashboard** reads this count from the same place (Node server + Supabase).
- **So that the count is correct everywhere (local + Vercel):** the counter is stored in **Supabase** in the table `site_stats` (key `total_visits`). All API instances (e.g. Vercel and your local server) use the same Supabase project, so they read/write the same number.
- **You must run the migration** so the table and function exist:
  ```bash
  npx supabase db push
  ```
  Or in Supabase Dashboard → SQL Editor, run the contents of `supabase/migrations/20250225000000_site_stats_table.sql`.

- **Dashboard:** The "حالة الموقع" box shows **إجمالي الزوار** (total visitors). The top stat card "عدد الزوار" shows the same value. Both come from `GET /api/dashboard/stats` (which reads `total_visits` from Supabase).

## Why visits might not be counting

1. **Migration not applied** – Run `npx supabase db push` (or apply the `site_stats` migration manually). Until then, the API may fall back to in-memory count (resets on restart and is not shared with the dashboard if the dashboard talks to another instance).
2. **Dashboard and site use different APIs** – If the dashboard uses `VITE_API_URL=http://localhost:3000` but the live site is on Vercel, the live site increments the counter on **Vercel’s** API (which uses Supabase). The dashboard must call the **same** API (or an API that uses the same Supabase project) to see that count. Using Supabase for the counter fixes this: both Vercel and local read/write the same `site_stats` table.
3. **CORS** – The site (e.g. `https://street-net-manager.vercel.app`) must be allowed to call your API. On Vercel, the site and API are same-origin, so no CORS issue. For local dev, the app calls `http://localhost:3000/api/track-visit` if `VITE_API_URL` is set.

## What you need for richer analytics (Node server + Supabase)

| Goal | What to add |
|------|-------------|
| **Total visitors (current)** | `site_stats` table + `increment_total_visits()` + `/api/track-visit` + dashboard reading from stats. ✅ Done. |
| **Visits per day** | Table e.g. `site_visits_daily (date DATE, count BIGINT)`. In `/api/track-visit`, also increment the row for today. Dashboard can then show a chart. |
| **Page views (which route)** | Frontend sends current path (e.g. `/subscribers`) to the API; API stores in a table like `page_views (path, date, count)` or append-only log (then aggregate in dashboard). |
| **Unique visitors (approx.)** | Keep counting sessions (one call per session, as now). For “unique per day,” store a hash of IP or session id per day (optional). |
| **Response time / errors** | Backend logs or a small middleware that writes to Supabase (e.g. `api_logs (path, status, duration_ms, created_at)`). Dashboard queries for charts. |

In short: **reading from the site** means the frontend calls your Node server (and optionally Supabase). For **best analytics**, add tables in Supabase for the metrics you care about (daily counts, page, timestamps), and have the Node server write to them on each relevant request or track-visit.
