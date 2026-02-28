# Admin Dashboard — API Contracts

All request/response bodies are JSON. All response keys use camelCase. All timestamps are ISO 8601 UTC strings unless noted. All counts are integers.

---

## Public endpoints

### 1. GET /health

**Purpose:** Liveness check. Do not count as a visit.

**Request:**
- Method: `GET`
- Path: `/health`
- Headers: none required

**Response (200):**
```json
{
  "ok": true,
  "serverUp": true,
  "statusText": "ok",
  "responseTimeMs": 2,
  "lastCheckAt": "2025-02-24T12:00:00.000Z"
}
```

**Notes:** `responseTimeMs` = time to generate response in ms. `lastCheckAt` = server time when response is sent (UTC).

---

### 2. POST /api/track-visit

**Purpose:** Register or refresh a visitor session (one call per app load, then every VISIT_REFRESH_MINUTES).

**Request:**
- Method: `POST`
- Path: `/api/track-visit`
- Headers: `Content-Type: application/json`
- Body:
```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Validation:** `sessionId` required, non-empty string, max 256 chars.

**Response (200):**
```json
{ "ok": true }
```

**Errors:**
- 400 — Invalid or missing sessionId: `{ "ok": false, "error": "sessionId is required" }`
- 429 — Rate limited: `{ "ok": false, "error": "Too many requests" }`

---

### 3. POST /api/heartbeat

**Purpose:** Refresh “user active now” (call every 60 seconds while app is open and user is logged in).

**Request:**
- Method: `POST`
- Path: `/api/heartbeat`
- Headers: `Content-Type: application/json`, `Authorization: Bearer <jwt>`
- Body (optional):
```json
{ "sessionId": "optional-session-id" }
```

**Response (200):**
```json
{ "ok": true }
```

**Errors:**
- 401 — Missing or invalid token: `{ "ok": false, "error": "Unauthorized" }`
- 429 — Rate limited: `{ "ok": false, "error": "Too many requests" }`

---

### 4. POST /api/track-event

**Purpose:** Record activity event (login, signup, app_open, action).

**Request:**
- Method: `POST`
- Path: `/api/track-event`
- Headers: `Content-Type: application/json`. Optional: `Authorization: Bearer <jwt>` (to attach userId).
- Body:
```json
{
  "type": "login",
  "actionName": "optional max 128 chars"
}
```

**Validation:** `type` required, one of: `login`, `signup`, `app_open`, `action`. `actionName` optional, string, max 128.

**Response (200):**
```json
{ "ok": true }
```

**Errors:**
- 400 — Invalid type: `{ "ok": false, "error": "type must be one of: login, signup, app_open, action" }`
- 429 — Rate limited: `{ "ok": false, "error": "Too many requests" }`

---

## Dashboard endpoints (protected)

All dashboard routes require header: `X-Dashboard-Secret: <DASHBOARD_SECRET>`. Same error shape for auth failure.

**Auth error (401):**
```json
{ "ok": false, "error": "Unauthorized" }
```

---

### 5. GET /api/dashboard/stats

**Request:**
- Method: `GET`
- Path: `/api/dashboard/stats`
- Headers: `X-Dashboard-Secret: <secret>`

**Response (200):**
```json
{
  "ok": true,
  "stats": {
    "totalVisitors": 15000,
    "totalVisits": 15000,
    "visitorsNow": 12,
    "visitorsToday": 340,
    "activeVisits": 8,
    "totalUsers": 420,
    "activeUsersNow": 8,
    "expiredUsers": 15,
    "inactiveUsers": 30,
    "activeSubscriptions": 390,
    "expiredSubscriptions": 18,
    "cancelledSubscriptions": 12,
    "serverUp": true,
    "statusText": "ok",
    "responseTimeMs": 45,
    "lastCheckAt": "2025-02-24T12:00:00.000Z",
    "appUrl": "https://myapp.com",
    "activityByDay": [
      { "date": "2025-02-24", "logins": 22, "signups": 2 },
      { "date": "2025-02-23", "logins": 18, "signups": 1 }
    ],
    "monthlyLogins": [
      { "month": "2025-02", "logins": 450 },
      { "month": "2025-01", "logins": 520 }
    ],
    "dailyActivity": [
      { "date": "2025-02-24", "logins": 22, "appOpens": 45, "actions": 120 },
      { "date": "2025-02-23", "logins": 18, "appOpens": 38, "actions": 95 }
    ],
    "planDistribution": { "basic": 200, "plus": 150, "pro": 40 },
    "plansPercentage": { "basic": 51.3, "plus": 38.5, "pro": 10.2 },
    "usersStatusPercentage": { "active": 87.5, "expired": 3.6, "inactive": 7.1 }
  }
}
```

**Notes:**
- `activityByDay`: last 7 days, UTC date, ascending order (oldest first).
- `monthlyLogins`: last 6 months, `month` as YYYY-MM, descending (newest first).
- `dailyActivity`: last 7 days, same as activityByDay but with appOpens and actions.
- Percentages are numbers (0–100), one decimal place.
- If a metric is not available, use 0 or [] as appropriate.

**Errors:**
- 401: Missing or invalid `X-Dashboard-Secret`: `{ "ok": false, "error": "Unauthorized" }`

---

### 6. GET /api/dashboard/users

**Request:**
- Method: `GET`
- Path: `/api/dashboard/users`
- Headers: `X-Dashboard-Secret: <secret>`
- Query:
  - `status` (optional): `active` | `expired` | `inactive`
  - `limit` (optional): number, default 100, max 500
  - `offset` (optional): number, default 0

**Response (200):**
```json
{
  "ok": true,
  "users": [
    {
      "id": "uuid",
      "username": "john",
      "displayName": "John",
      "role": "oadmin",
      "orgId": "uuid",
      "orgName": "Acme",
      "plan": "plus",
      "status": "active",
      "createdAt": "2025-01-15T10:00:00.000Z",
      "updatedAt": "2025-02-24T11:00:00.000Z",
      "endsAt": "2025-03-15T10:00:00.000Z",
      "daysLeft": 19
    }
  ],
  "total": 420
}
```

**User object:** `status` = `active` | `expired` | `inactive`. `endsAt` = subscription end (null if none). `daysLeft` = days until endsAt (0 or negative if expired). All timestamps UTC ISO.

**Errors:**
- 401: `{ "ok": false, "error": "Unauthorized" }`
- 400: Invalid query (e.g. invalid status): `{ "ok": false, "error": "Invalid status" }`

---

## Generic error shape

For any 4xx/5xx that returns JSON:

```json
{ "ok": false, "error": "<human-readable message>" }
```

Status codes: 400 (validation), 401 (auth), 403 (forbidden), 429 (rate limit), 500 (server error).
