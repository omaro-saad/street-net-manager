# Admin Dashboard — Security and Operations

---

## 1. Dashboard authentication

- All routes under `/api/dashboard/*` **must** require the header **`X-Dashboard-Secret`** with value equal to `process.env.DASHBOARD_SECRET`.
- If `DASHBOARD_SECRET` is not set, respond with **503** and `{ "ok": false, "error": "Dashboard API is not configured (DASHBOARD_SECRET missing)." }`.
- If the request does not send `X-Dashboard-Secret` or the value does not match, respond with **401** and `{ "ok": false, "error": "Unauthorized" }`.
- Optional: also accept `Authorization: Bearer <DASHBOARD_SECRET>` for the same purpose (so dashboard can send the secret as Bearer token).

**Example middleware (Express):**

```js
function requireDashboardSecret(req, res, next) {
  const secret = process.env.DASHBOARD_SECRET;
  if (!secret) {
    return res.status(503).json({ ok: false, error: "Dashboard API is not configured (DASHBOARD_SECRET missing)." });
  }
  const headerSecret = req.headers["x-dashboard-secret"];
  const bearer = req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7) : null;
  const provided = headerSecret || bearer;
  if (provided !== secret) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }
  next();
}
```

Mount it on the dashboard router: `router.use(requireDashboardSecret);`.

---

## 2. Rate limiting

- **Public endpoints** (`/api/track-visit`, `/api/heartbeat`, `/api/track-event`): apply a per-IP (or per-identifier) rate limit to reduce abuse. Example: 60 requests per minute per IP for track-visit and track-event; 120 per minute for heartbeat (one every 60s leaves headroom).
- **Dashboard endpoints:** Optional stricter limit (e.g. 200/minute per IP) or no limit if only used by a single dashboard client.
- On limit exceeded: **429** and `{ "ok": false, "error": "Too many requests" }`.

---

## 3. CORS

- If the dashboard is served from a different origin than the API, allow that origin in CORS. Set `Access-Control-Allow-Origin` to the dashboard origin (e.g. `process.env.DASHBOARD_ORIGIN`). Use credentials if the dashboard sends cookies or the `X-Dashboard-Secret` header (e.g. `credentials: true`).
- Do not use `*` for origin when `X-Dashboard-Secret` or credentials are used; use an explicit allowlist.

---

## 4. Input validation

- **POST /api/track-visit:** Require `sessionId` in body; non-empty string; max length 256. Return **400** with `{ "ok": false, "error": "sessionId is required" }` (or similar) when invalid.
- **POST /api/track-event:** Require `type` in body; must be one of `login`, `signup`, `app_open`, `action`. Optional `actionName`: string, max 128. Return **400** with a clear message (e.g. `"type must be one of: login, signup, app_open, action"`) when invalid.
- **GET /api/dashboard/users:** Validate query params: `status` one of `active` | `expired` | `inactive`; `limit` number, default 100, max 500; `offset` number, default 0. Return **400** with `{ "ok": false, "error": "Invalid status" }` (or similar) when invalid.

---

## 5. Error responses

- All JSON errors use the shape: `{ "ok": false, "error": "<human-readable message>" }`.
- Use status codes: **400** (validation), **401** (auth), **403** (forbidden), **429** (rate limit), **500** (server error).

---

## 6. Logging

- Log at least: 4xx/5xx responses (path, status, message); dashboard auth failures (without logging the secret); and server errors (stack or message). Do not log request bodies that may contain secrets or PII in full; log only minimal identifiers (e.g. “track-visit sessionId present”) if needed for debugging.
- Keep logs minimal but useful for ops: e.g. `[dashboard/stats] 200`, `[track-visit] 400 sessionId missing`, `[heartbeat] 401`.

---

## 7. IP and User-Agent (no raw storage)

- **Never store raw IP or full User-Agent** in the database. Store only:
  - **ip_hash:** e.g. `SHA-256(salt + ip)` with a server-side salt, or `SHA-256(ip)` if no salt. Use for dedupe/abuse detection only.
  - **ua_hash:** e.g. hash of User-Agent string (same algorithm). Optional.
- Same for any logs: do not persist raw IP; use a short hash or omit.

---

## 8. Anti-spam / dedupe for visits

- Use **sessionId** as the primary key for a visitor session (one row per session in `visitor_sessions`).
- If the same `sessionId` is sent again within a short window (e.g. **2 minutes**), only update `last_seen_at`; do not create a new row and do not double-count.
- Optionally use `ip_hash` / `ua_hash` to block or throttle obviously abusive patterns (e.g. many different sessionIds from same ip_hash in a short time). Document the chosen strategy in this file or in the step-by-step guide.

---

## 9. Health check

- **GET /health** must **not** write to `visitor_sessions`, `activity_events`, or any visit counter. It is read-only (and may return server time and a simple “ok” payload). Do not count health checks as visits.
