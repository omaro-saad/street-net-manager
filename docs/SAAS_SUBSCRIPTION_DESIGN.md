# SaaS Subscription & Limits – Technical Design & Implementation Plan

**Scope:** Web-based SaaS with Node.js backend + Supabase (Postgres + Auth). Plan limits enforced in backend and frontend. No invented requirements; ask if any detail is missing.

---

## 1. Subscription Plans (Feature Flags + Limits) – Reference

| Feature / Limit | Basic | Plus | Pro |
|-----------------|-------|------|-----|
| **subscribers** | enabled, 15 | enabled, 30 | unlimited |
| **distributors** | enabled, 7 | enabled, 20 | unlimited |
| **lines** | enabled, 3 | enabled, 6 | unlimited |
| **maps** | disabled | enabled, 10 nodes/line | unlimited |
| **packages** | 2 subscriber + 2 distributor | 8 + 8 | unlimited |
| **devices** | disabled | enabled, 5 stores (warehouses) | unlimited |
| **employees** | enabled, 5 | enabled, 9 | unlimited |
| **finance** | manual 30, auto ∞ | manual 60, auto ∞ | unlimited |
| **settings** | enabled | enabled | enabled |

**Pricing (do not change):**

| Plan | Monthly | 3 Months | Yearly |
|------|---------|----------|--------|
| Basic | $5 (20 NIS) | $16 (50 NIS) | $50 (150 NIS) |
| Plus | $10 (30 NIS) | $28 (87 NIS) | $110 (340 NIS) |
| Pro | $15 (45 NIS) | $40 (120 NIS) | $150 (460 NIS) |

**Add-on (Ouser):** $30 one-time. Naming: **Oadmin** = admin user (every organization has exactly one to access the account). **Ouser** = the extra user when the add-on is purchased. The add-on is paid, offered to all subscriptions; when creating a subscription it is offered as yes/no. If not purchased: org has only Oadmin. If purchased: org has Oadmin + Ouser. Ouser accesses the same database as Oadmin but with different permissions (read/write per module, configured by Oadmin). Ouser cannot be granted access to any module disabled by the plan.

---

## 2. Clarifications (confirmed)

- **Stores (devices):** **Stores = warehouses.** In the app, DevicesPage stores devices in **inventory.warehouses** (plus sections and items). One “store” = one warehouse. Plus plan limit “5 stores” = max 5 warehouses. Backend enforces count of `inventory.warehouses`.
- **Manual activation:** For now the app depends on **const organization** (organizations and subscriptions defined in code). Later a dashboard will be developed to create/activate subscriptions. Design keeps `subscriptions.status` (e.g. `pending | active | expired`) and an admin action to set `active`.
- **Finance manual vs automatic:**
  - **Manual:** User-created in FinancePage (manual invoice form). Stored in `manualInvoices` (or `finance._kv.manualInvoices`). Plan limit applies to the **count of manual entries**.
  - **Automatic:** System-created; come from SubscribersPage, DistributorsPage, and EmployeesPage (e.g. package renewals, invoices generated from those flows). Stored in `autoInvoices`. Unlimited for all plans; no limit count.

---

## 3. A) Database Schema (Supabase / Postgres)

### 3.1 Organizations

```sql
-- One row per customer (organization).
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_organizations_slug ON organizations(slug);
```

### 3.2 Users & Roles (Supabase Auth + custom tables)

- Use **Supabase Auth** for login (email/password or preferred method).  
- Store **organization-scoped** user and role in your own tables.

```sql
-- Links Supabase auth user to organization and role.
CREATE TABLE org_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  auth_user_id UUID NOT NULL,  -- Supabase auth.users.id
  role TEXT NOT NULL CHECK (role IN ('oadmin', 'ouser')),
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, auth_user_id)
);

CREATE INDEX idx_org_users_org ON org_users(org_id);
CREATE INDEX idx_org_users_auth ON org_users(auth_user_id);
```

- **RLS / application logic:** All API access is scoped by `org_id` derived from the current `auth_user_id` (via `org_users`). No cross-org access.

### 3.3 Subscriptions (plan, duration, dates, status)

```sql
CREATE TYPE plan_tier AS ENUM ('basic', 'plus', 'pro');
CREATE TYPE plan_duration AS ENUM ('monthly', '3months', 'yearly');
CREATE TYPE subscription_status AS ENUM ('pending', 'active', 'expired', 'cancelled');

CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan plan_tier NOT NULL,
  duration plan_duration NOT NULL,
  status subscription_status NOT NULL DEFAULT 'pending',
  started_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id)  -- one active subscription per org; for history keep old rows and use status/ends_at
);

-- Optional: if you want to keep full history, remove UNIQUE(org_id) and add a "current" view or query by status/ends_at.
CREATE INDEX idx_subscriptions_org ON subscriptions(org_id);
CREATE INDEX idx_subscriptions_status_ends ON subscriptions(org_id, status, ends_at);
```

### 3.4 Add-on: Ouser (one-time $30)

```sql
CREATE TABLE org_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  addon_key TEXT NOT NULL,
  enabled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, addon_key)
);

-- Example row: org_id, addon_key = 'employee_permissions', enabled_at = now().
CREATE INDEX idx_org_addons_org ON org_addons(org_id);
```

### 3.5 Employee permissions (which modules/pages the employee can access)

- Permission keys must match **modules/pages allowed by the plan** (e.g. no `map` on Basic).  
- Stored per-org, for the employee user.

```sql
-- Modules we gate (must match plan features).
-- Keys: subscribers, distributors, lines, map, packages, devices, employee, finance, settings
CREATE TABLE employee_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_user_id UUID NOT NULL REFERENCES org_users(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_user_id, module_key)
);

CREATE INDEX idx_employee_permissions_org_user ON employee_permissions(org_user_id);
```

- **Rule:** Backend and frontend only allow adding a permission for `module_key` if the **current plan** has that module enabled. If plan has maps disabled, employee cannot have `map` permission.

### 3.6 Plan limits (static config table or code)

- Limits are fixed per plan; no need to store them in DB per subscription if you prefer.  
- Option A: **Table** (easier to change later):

```sql
CREATE TABLE plan_limits (
  plan plan_tier NOT NULL,
  limit_key TEXT NOT NULL,
  limit_value INT,  -- NULL = unlimited (or use -1 in app)
  PRIMARY KEY (plan, limit_key)
);

-- Example rows (limit_value NULL or -1 = unlimited).
-- basic: subscribers 15, distributors 7, lines 3, maps_enabled 0, map_nodes_per_line 0,
--        packages_subscriber 2, packages_distributor 2, devices_enabled 0, devices_stores 0,
--        employees 5, finance_manual 30
-- plus:  subscribers 30, distributors 20, lines 6, maps_enabled 1, map_nodes_per_line 10,
--        packages_subscriber 8, packages_distributor 8, devices_enabled 1, devices_stores 5,
--        employees 9, finance_manual 60
-- pro:   all unlimited (NULL or -1)
```

- Option B: **Code-only** config (single source of truth in Node): e.g. `server/config/plans.js` exporting limits per plan. Backend and frontend (via API) use the same limits.

### 3.7 App data (org-scoped; existing concepts)

- All tenant data must be keyed by `org_id`. Example table names (conceptual; align with your current schema):

- `subscribers` → `org_id`, then existing fields  
- `distributors` → `org_id`  
- `lines` → `org_id`  
- `packages` → `org_id` (+ type: subscriber vs distributor if you have two lists)  
- `employees` (org users with role employee + permissions) → already under `org_users` + `employee_permissions`  
- `finance` → store per org (e.g. `finance_kv` with `org_id`, key, value or JSON); manual/auto entries counted for limits  
- `maps` → per line: `org_id`, `line_id`, nodes (count for “nodes per line” limit)  
- `devices` (warehouses) → `org_id`; “stores” = **warehouses** (inventory.warehouses in DevicesPage); count for Plus limit 5

- **Finance manual limit:** Ensure you have a way to count “manual” entries (e.g. `entry_type = 'manual'` or only count `manualInvoices`). Backend rejects create when count >= plan limit and returns a clear “upgrade” message.

---

## 4. B) Backend Node.js API Design

### 4.1 Authentication (Supabase Auth)

- **Login:** Frontend uses Supabase Auth (e.g. `signInWithPassword`). On success, frontend gets a JWT (Supabase session).
- **Backend:** Validate Supabase JWT on every request (using Supabase client or a JWT library with Supabase’s JWT secret). From the JWT, get `auth_user_id` (sub).
- **Resolve org and role:**  
  - Load `org_users` by `auth_user_id` → get `org_id`, `role`.  
  - If no row or org inactive, return 401.  
  - Attach `req.orgId`, `req.orgUserId`, `req.role` for downstream middleware and handlers.

### 4.2 Authorization (middleware)

- **Subscription active:** After resolving org, load current subscription (e.g. `status = 'active'` and `ends_at > now()`). If none, return 403 with message like “لا يوجد اشتراك فعّال”.
- **Plan and limits:** Load plan from subscription; load limits from config (table or `plans.js`). Attach `req.plan`, `req.limits` (or a small helper that returns limit for a key).
- **Ouser:** If `req.role === 'ouser'`, load `employee_permissions` (Ouser permissions) for `req.orgUserId`. Attach `req.allowedModules`. For any request that targets a module, check that the module is in `req.allowedModules`; if not, return 403. Ouser has same DB as Oadmin but with (read/write) permissions per module as configured.

### 4.3 Endpoints (high level)

- **Health:** `GET /health` (no auth).
- **Auth (Supabase):**  
  - Login is done on the client with Supabase; backend may expose a “me” that returns current user + org + plan + role + permissions (and optionally limits) so the frontend can gate UI.

- **Organization + subscription (manual activation):**  
  - `POST /api/admin/organizations` (or internal only): create organization, optional addon, subscription (status `pending`), and first user (Admin). Only for your admin/support flow.  
  - `PATCH /api/admin/subscriptions/:id` (or internal): set `status = 'active'`, `started_at`, `ends_at`. No Stripe; manual only.

- **Current context (for frontend gating):**  
  - `GET /api/me` or `GET /api/auth/me`: returns `{ user, org, subscription: { plan, duration, status, endsAt }, role, allowedModules (if employee), limits }`. Frontend uses this to hide/disable features and show upgrade prompts.

- **Plan/limits check:**  
  - Backend does **not** expose a separate “check limit” endpoint for each resource; instead, every **create** (and where relevant update) checks the limit and returns **409 or 422** with a clear message when over limit: e.g. “لقد وصلت لحد الخطة. يرجى الترقية.” (You’ve reached the plan limit. Please upgrade.)

- **CRUD per module (all under auth + org scope):**  
  - Subscribers: `GET/POST /api/subscribers`, `PUT/DELETE /api/subscribers/:id`  
  - Distributors: same pattern  
  - Lines: same  
  - Maps: `GET/PUT /api/lines/:lineId/map` (or similar); check plan allows maps and, for Plus, `nodes count <= limit`  
  - Packages: CRUD; two limits (subscriber packages vs distributor packages)  
  - Devices: CRUD; check plan allows devices and, for Plus, “stores” count <= 5  
  - Employees: CRUD (for admin); count employees (org_users with role employee) and enforce limit  
  - Finance: GET/PUT or per-entry API; when adding a **manual** entry, count manual entries for org; if count >= plan limit, return 409/422 with upgrade message  
  - Settings: GET/PUT (no extra limits beyond “settings enabled”)

- **Employee permissions (only if add-on enabled):**  
  - `GET /api/org/employee-permissions` (admin only): list permissions for the org’s employee user.  
  - `PUT /api/org/employee-permissions`: admin sets list of `module_key`; backend validates each `module_key` against **current plan** (only allowed modules). If any is not in plan, return 400. Save to `employee_permissions`.

### 4.4 Server-side validation (enforce limits)

- **Every create (and where relevant update):**  
  - Resolve org and plan.  
  - Load current count for that resource (subscribers, lines, manual finance entries, map nodes per line, etc.).  
  - If limit is defined and count >= limit, respond with **409 Conflict** (or 422) and a stable message: e.g. “لقد وصلت لحد الخطة. يرجى الترقية.”  
  - Do **not** rely on frontend to send “current count”; always compute count on the server from DB.

- **Maps:** For Plus, limit is “10 nodes per line”. On save map for a line, count nodes; if > 10, reject with same upgrade message.

- **Packages:** Two counters: subscriber packages, distributor packages. Enforce separately.

- **Finance manual:** Count only manual entries (e.g. `manualInvoices` or `entry_type = 'manual'`). Enforce on insert.

---

## 5. C) Frontend Rules

### 5.1 Plan-based gating (all users)

- **Data source:** On app load (and after login), call `GET /api/me` (or equivalent) to get `plan`, `limits`, and optionally current **usage** (counts) if the API returns them.
- **Nav and routes:**  
  - **Maps:** If plan has maps disabled, hide “الخريطة” from nav and redirect `/map` → e.g. home or a “upgrade required” page.  
  - **Devices:** Same if devices disabled.  
  - **Other modules:** Shown only if enabled for plan; buttons “Add subscriber” / “Add line” etc. disabled when at limit, with tooltip/message: “لقد وصلت لحد الخطة. يرجى الترقية.”
- **Per-module limits:**  
  - Subscribers: disable “Add” when `subscribersCount >= limit`, show upgrade message.  
  - Same for distributors, lines, packages (both types), employees, finance manual entries, map nodes per line, device stores.

### 5.2 Ouser UI (add-on only)

- If add-on not purchased: only Oadmin exists; no “Ouser permissions” UI.  
- If add-on purchased:  
  - Oadmin sees “Ouser permissions” (e.g. in Settings or a dedicated page).  
  - Permission selection: per **module** that the **plan** allows (read/write). Do **not** show modules disabled by the plan.  
  - Frontend sends allowed module keys (and optionally read/write) to `PUT /api/org/ouser-permissions`; backend re-validates.

### 5.3 Upgrade message (consistent)

- Whenever the user hits a limit (backend returns 409/422 with upgrade message), show that exact message (or a fixed string): “لقد وصلت لحد الخطة. يرجى الترقية.”  
- Optionally show an upgrade CTA (link to plans or contact).

---

## 6. D) Edge Cases / Security

### 6.1 Multi-tenancy

- **All queries** filtered by `org_id`. Resolve `org_id` from authenticated user (Supabase JWT → `org_users` → `org_id`). Never trust `org_id` from body or query.  
- **Row-level security (RLS):** If using Supabase Postgres, add RLS so that even direct DB access only returns rows for the user’s org. Policies: `org_id = (SELECT org_id FROM org_users WHERE auth_user_id = auth.uid())`.

### 6.2 Ouser privilege escalation

- Backend: for every request that accesses a module, if `role === 'ouser'`, require that module to be in `req.allowedModules`. Return 403 if not.  
- Ouser cannot set own permissions or change role; only Oadmin can.  
- Oadmin-only endpoints (create org, set subscription active, set Ouser permissions) restricted to `role === 'oadmin'` (or super-admin for platform-level actions).

### 6.3 Bypassing plan limits

- **No trust in client:** All limits enforced in backend. Even if frontend is bypassed (e.g. direct API call with another count), server recomputes count and rejects when at/over limit.  
- **Consistent response:** When over limit, always return same structure (e.g. 409 + `{ ok: false, code: 'PLAN_LIMIT_REACHED', message: '...' }`) so frontend can show the same “يجب الترقية” experience.

### 6.4 Subscription state

- If subscription is expired or not active, block access to app (or show “اشتراك منتهي” and only allow upgrade/contact). Enforce in backend on every request after auth.

---

## 7. Implementation order (suggested)

1. **Supabase:** Create project; Auth enabled; create tables (organizations, org_users, subscriptions, org_addons, employee_permissions, plan_limits or use code config).  
2. **Backend:** Auth middleware (Supabase JWT → org_id, role); subscription and plan middleware; plan limits config; then CRUD endpoints with org scoping and limit checks.  
3. **Frontend:** Call `GET /api/me`; gate nav and “Add” buttons by plan and usage; show upgrade message on limit; employee permission screen (plan-aware) when add-on enabled.  
4. **Admin flow:** Minimal flow or manual DB updates to create org + subscription (pending) and set subscription to active.

---

## 8. Limit-reached message (reuse everywhere)

- **Backend:** When a create/update would exceed plan limit, return HTTP 409 (or 422) with body, e.g.:  
  `{ ok: false, code: 'PLAN_LIMIT_REACHED', message: 'لقد وصلت لحد الخطة. يرجى الترقية.' }`  
- **Frontend:** On 409/422 with that code, show the same message and optionally an upgrade link. Use this every time the user tries to go over their limits.

---

---

## 9. App module keys (for permissions & gating)

Use these consistently in DB, backend, and frontend:

| Module key   | Route      | Nav label   |
|-------------|------------|-------------|
| `subscribers` | /subscribers | المشتركين   |
| `distributors` | /distributors | الموزعين   |
| `lines`     | /lines     | خطوط الشبكة |
| `map`       | /map       | الخريطة     |
| `packages`  | /packages  | الحزم       |
| `devices`   | /devices   | الاجهزة     |
| `employee`  | /employee | الموظفين    |
| `finance`   | /finance  | المالية     |
| `settings`  | /settings  | الاعدادات   |

Home (`/`) can be allowed for all; permission entries only needed for the modules above.

---

## 10. Organizations and users (current app)

Organizations and subscriptions are defined in the DB (Supabase). Users (Oadmin/Ouser) are created via the **create-user** CLI and stored in `accounts`; no hardcoded test users.

- **Oadmin:** Full access to all modules allowed by the plan. Created via CLI with plan and duration.
- **Ouser:** Same database as Oadmin; permissions in `account_permissions`. Add-on is offered at org creation (yes/no); when yes, org has Oadmin + Ouser.

---

*End of design document. No limits or prices were invented; all values from your spec. Ask for any missing detail before implementation.*
