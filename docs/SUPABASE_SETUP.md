# Supabase setup

## No Docker: use hosted Supabase only

You can use Supabase **without Docker**. Use only your **hosted project** on supabase.com:

1. **Create a project** at [supabase.com](https://supabase.com) → New project.
2. **Link the repo** to that project (one time):
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   ```
   (Project ref is in the dashboard URL: `https://app.supabase.com/project/<project-ref>`.)
3. **Apply migrations to the cloud** (no Docker):
   ```bash
   npx supabase db push
   ```
   This sends the SQL in `supabase/migrations/` to your **hosted** database. You will be prompted for your database password if needed.
4. **Set env vars** in `server/.env`: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (from dashboard → Settings → API).
5. **Create users** with the app CLI (uses the cloud DB):
   ```bash
   npm run create-user -- <username> <password> <secretCode> <plan> <duration>
   ```

**Do not run** `supabase start`, `supabase db reset`, or `supabase stop` — those require Docker for a local Supabase stack. With the steps above, everything runs against your hosted project and no Docker is needed.

---

## Reset hosted DB (no Docker)

To **fully reset** your hosted Supabase database (drop all tables and re-apply migrations), use the app script instead of `supabase db reset`:

1. **Get the database connection string**  
   Supabase Dashboard → your project → **Settings** → **Database** → **Connection string** → **URI**.  
   Use **Session mode**, copy the URI, and replace `[YOUR-PASSWORD]` with your database password.

2. **Add to `server/.env`:**
   ```env
   SUPABASE_DB_URL=postgresql://postgres.[project-ref]:YOUR_PASSWORD@aws-0-xx.pooler.supabase.com:5432/postgres
   ```

3. **Install server dependencies** (if you haven’t):
   ```bash
   cd server && npm install
   ```

4. **Run the reset** (from the repo root or from `server/`):
   ```bash
   cd server && npm run reset-db-remote
   ```
   Type `yes` when prompted. This drops the `public` schema and re-runs all SQL in `supabase/migrations/`.

No Docker or Supabase CLI link is required. After the reset, create users again with `npm run create-user`.

**If you get "permission denied for table organizations"** when running `create-user` (e.g. after a manual schema change or a reset without the script): run the following in **Supabase Dashboard → SQL Editor** so the API roles can access tables:

```sql
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
```

Then run `create-user` again.

---

## What's next (after linking)

1. **Add environment variables** (see [Environment variables](#environment-variables) below) in:
   - Project root `.env`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
   - `server/.env`: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

2. **Push the database schema** to your linked project:
   ```bash
   npx supabase db push
   ```
   This runs the migration in `supabase/migrations/` (organizations, subscriptions, accounts, **lines**, plan_limits, RLS, etc.). The **lines** table stores Lines page data per organization; the API uses it when Supabase is configured.

3. **Create your first org and user** (CLI, command-line args):
   ```bash
   npm run create-user -- <OadminUsername> <OadminPassword> <secretCode> <plan> <duration>
   ```
   **Required:** `secretCode` = 6 digits (stored hashed; give to customer for password reset).  
   **plan:** `basic` | `plus` | `pro`. **duration:** `monthly` | `3months` | `yearly`.

   **With add-on Ouser:**
   ```bash
   npm run create-user -- <OadminUsername> <OadminPassword> <secretCode> <plan> <duration> <OuserUsername> <OuserPassword> <OuserSecretCode>
   ```
   The CLI creates one organization, one subscription (active, with `ends_at`), and accounts in the DB. At the end it prints a **message to send to the customer** (login details + secret codes). Secret codes are stored hashed and cannot be retrieved.  
   Ensure `server/.env` has `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` before running.

   **Login and account settings:** When `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set, the backend uses the **accounts** table in Supabase for login, profile (update username), and reset password. Without them, it uses in-memory test users.

4. **Wire the app to Supabase** (when ready): use `@supabase/supabase-js` in the frontend for Auth and/or data, and in the Node server use the same client with the service role key for admin operations. See `docs/SAAS_SUBSCRIPTION_DESIGN.md` for API design.

---

## What you need

1. **A Supabase project** (create one at [supabase.com](https://supabase.com) → New project).
2. **From the project dashboard** (Settings → API):
   - **Project URL** — e.g. `https://xxxxxxxx.supabase.co`
   - **anon (public) key** — safe for frontend / browser
   - **service_role key** — backend only, never expose in frontend

3. **Environment variables** (see below).

---

## Terminal setup (CLI)

### 1. Install Supabase CLI (in this repo)

```bash
npm install -g supabase
```

Or use it without global install:

```bash
npx supabase --version
```

### 2. Log in to Supabase (one time)

```bash
npx supabase login
```

This opens the browser to authenticate.

### 3. Supabase folder in this project

This repo already has `supabase/config.toml` and `supabase/migrations/`. If you prefer to regenerate them:

```bash
npx supabase init
```

### 4. Link to your remote project

Get your **project ref** from the dashboard URL:  
`https://app.supabase.com/project/<project-ref>`.

```bash
npx supabase link --project-ref <project-ref>
```

You will be prompted for the database password (set when creating the project).

### 5. Run migrations (after you add SQL files)

```bash
npx supabase db push
```

**Optional (requires Docker):** For a full local Supabase stack you would run `npx supabase start` and `npx supabase db reset`. If you prefer no Docker, use only the hosted project and `npx supabase db push` as in the [No Docker](#no-docker-use-hosted-supabase-only) section above.

---

## Environment variables

### Frontend (Vite)

Create or edit `.env` in the **project root** (street-net-manager):

```env
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

- Use **Project URL** for `VITE_SUPABASE_URL`.
- Use **anon public** key for `VITE_SUPABASE_ANON_KEY`.

### Backend (Node.js server)

Create or edit `.env` in the **server** folder:

```env
SUPABASE_URL=https://xxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
# Optional, for reset-db-remote only (Dashboard → Settings → Database → Connection string URI):
# SUPABASE_DB_URL=postgresql://postgres.[ref]:[PASSWORD]@...supabase.com:5432/postgres
```

- Use **Project URL** for `SUPABASE_URL`.
- Use **service_role** key for `SUPABASE_SERVICE_ROLE_KEY` (never in frontend).
- **SUPABASE_DB_URL** is only needed for `npm run reset-db-remote` (full DB reset without Docker).

---

## Checklist

- [ ] Create a Supabase project at supabase.com (enable RLS when prompted).
- [ ] Copy Project URL and anon key → root `.env` as `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- [ ] Copy Project URL and service_role key → `server/.env` as `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- [ ] Run `npx supabase login` then `npx supabase link --project-ref <ref>` to link this repo to the project.
- [ ] Add migrations under `supabase/migrations/` (see `docs/SAAS_SUBSCRIPTION_DESIGN.md` for schema) and run `npx supabase db push` when ready.
