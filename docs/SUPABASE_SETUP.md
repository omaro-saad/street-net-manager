# Supabase setup

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

Or for local development with a local Supabase stack:

```bash
npx supabase start
npx supabase db reset
```

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
```

- Use **Project URL** for `SUPABASE_URL`.
- Use **service_role** key for `SUPABASE_SERVICE_ROLE_KEY` (never in frontend).

---

## Checklist

- [ ] Create a Supabase project at supabase.com (enable RLS when prompted).
- [ ] Copy Project URL and anon key → root `.env` as `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- [ ] Copy Project URL and service_role key → `server/.env` as `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- [ ] Run `npx supabase login` then `npx supabase link --project-ref <ref>` to link this repo to the project.
- [ ] Add migrations under `supabase/migrations/` (see `docs/SAAS_SUBSCRIPTION_DESIGN.md` for schema) and run `npx supabase db push` when ready.
