# Backend API — مدير شبكتك

Node.js (Express) backend for secure API and full control. Ready to link a database.

## Run

```bash
cd server
cp .env.example .env
# Edit .env: set PORT and JWT_SECRET
npm install
npm start
# Or with auto-reload:
npm run dev
```

Default: `http://localhost:3000`

## Auth & plans (DB / Supabase)

- **POST /api/auth/login**  
  Body: `{ "username": "...", "password": "..." }`  
  Users are stored in the database (Supabase when configured). Login checks username/password and active subscription; if none, returns 401/403.

- **GET /api/auth/me**  
  Header: `Authorization: Bearer <token>`  
  Returns: `{ "ok": true, user, org, subscription, role, allowedModules, limits, usage }`

**Users** are created via the CLI:  
`npm run create-user -- <OadminUsername> <OadminPassword> <6-digit-secretCode> <plan> <duration>`  
Optional add-on: append ` <OuserUsername> <OuserPassword> <6-digit-secretCode>`.  
Plan: basic|plus|pro. Duration: monthly|3months|yearly. No hardcoded test users.

**Stores (devices):** Limit = warehouses (DevicesPage: `inventory.warehouses`). Plus = 5 warehouses max.

**Frontend:** To use API login (and plan/limits from DB), run the app with:
```bash
VITE_API_URL=http://localhost:3000 npm run dev
```
Log in with a user created in the DB (e.g. via `npm run create-user`).

All `/api/*` routes except `/api/auth/login` require:

```
Authorization: Bearer <your-jwt-token>
```

## Data API (all require auth)

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/data | Full app state (subscribers, distributors, lines, packages, employees, finance, inventory, maps, auth) |
| PUT | /api/data | Replace full state (body: `{ data: { ... } }`) |
| GET/POST/PUT/DELETE | /api/subscribers | CRUD subscribers |
| GET/POST/PUT/DELETE | /api/distributors | CRUD distributors |
| GET/POST/PUT/DELETE | /api/lines | CRUD lines |
| GET/POST/PUT/DELETE | /api/packages | CRUD packages |
| GET/POST/PUT/DELETE | /api/employees | CRUD employees |
| GET/PUT | /api/finance | Finance key-value store |
| GET/PUT | /api/inventory | Inventory (warehouses, sections, items) |
| GET/PUT | /api/maps/:lineId | Map data per line |

## Link a database

Currently the store is **in-memory** (`server/db/store.js`). To use a real DB:

1. **SQLite** (same repo, no extra service):
   - Add `better-sqlite3` in `server/package.json`.
   - Create `server/db/sqlite.js` that implements the same interface as `store.js`: `getFullState`, `setFullState`, and the same `subscribers`, `distributors`, `lines`, `packages`, `employees`, `finance`, `inventory`, `maps` objects with `list`, `add`, `update`, `remove` (or `get`/`set` where applicable).
   - In `server/routes/api.js` and `server/routes/auth.js`, replace `from "../db/store.js"` with `from "../db/sqlite.js"` (or a factory that picks store vs sqlite from env).

2. **PostgreSQL / MySQL**:
   - Add a client (e.g. `pg`, `mysql2`) and create `server/db/pg.js` with the same interface.
   - Use connection string from `.env` (e.g. `DATABASE_URL`).
   - Tables: one per entity (subscribers, distributors, lines, packages, employees); finance/inventory/maps as JSON columns or separate tables.

3. **Auth in DB**:
   - In `server/db/auth.js`, replace in-memory user lookup with a DB query (e.g. `users` table with `id`, `username`, `passwordHash`).
   - Store password hashes with bcrypt (add `bcrypt` and hash on register, compare on login).

After the DB layer is in place, the existing routes and middleware stay the same; only the `server/db/*` imports change.
