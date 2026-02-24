# Test Account & Seed Data

## Test user (for development/testing)

| Field         | Value    |
|--------------|----------|
| **Username** | `test`   |
| **Password** | `test`   |
| **Secret code** | `123456` (for password reset / username change) |

The test user must be created with **pro** plan so that limits allow 200+ items per entity.

---

## 1. Create the test account (once)

From **project root**:

```bash
npm run create-user -- test test 123456 pro yearly
```

Or from `server/`:

```bash
node scripts/create-user.js test test 123456 pro yearly
```

This creates an organization with one **Oadmin** user: username `test`, password `test`, secret code `123456`, **pro** plan, **yearly** duration.

---

## 2. Start the API server

From project root:

```bash
npm run server
```

Or:

```bash
cd server && npm start
```

Default port is **3000** (or set `PORT` in `server/.env`).

---

## 3. Seed 200 items per entity

From **project root** (with server running):

```bash
npm run seed
```

Or from `server/`:

```bash
node scripts/seed-test-data.js
```

**Options:**

- Custom API URL:  
  `API_URL=http://localhost:3000 npm run seed`  
  or  
  `node scripts/seed-test-data.js http://localhost:3001`
- Custom credentials:  
  `SEED_USER=myuser SEED_PASSWORD=mypass npm run seed`

**What gets created:**

| Entity        | Count | Notes |
|---------------|-------|--------|
| Lines         | 200   | خط تجريبي 1 … 200 |
| Packages      | 200   | 100 subscriber + 100 distributor |
| Subscribers   | 200   | Linked to lines and subscriber packages |
| Distributors  | 200   | Linked to lines |
| Employees     | 200   | موظف تجريبي 1 … 200 |
| Inventory     | 2 warehouses, 10 sections, 200 items | |
| Finance       | 200 manual invoices | |
| Map nodes     | 200 total | 20 nodes on each of the first 10 lines |

Data is **virtual/repeated** (same structure, different labels/IDs) so you can test list performance, filters, and UI with real counts.

---

## 4. Use the app

1. Point the app at the API (e.g. `VITE_API_URL=http://localhost:3000` when running the frontend).
2. Log in with **test** / **test**.
3. Use **Settings → Change username** with secret code **123456** if you need to test that flow.
4. Use **Settings → Change password** (reset) with username **test**, secret code **123456**, and a new password.
