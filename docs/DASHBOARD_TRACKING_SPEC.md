# Admin Dashboard — Tracking Specification

All timestamps UTC.

## Visitor and visits (stored in visitor_sessions)

- **Visitor session:** One unique browser session identified by client-generated `sessionId` (e.g. in localStorage). One row per `session_id` in `visitor_sessions`. Each row has `first_seen_at`, `last_seen_at` (updated on every track-visit).
- **totalVisits / totalVisitors:** Count of rows in `visitor_sessions` (lifetime). Same value.
- **visitorsNow:** Count where `last_seen_at > now() - 5 minutes`. TTL = 5 minutes (config: `NOW_TTL_MINUTES`, default 5).
- **visitorsToday:** Count where `last_seen_at` is on current UTC date.
- **activeVisits:** Count where `last_seen_at > now() - 10 minutes`. A visit is **active** if there was any activity (a track-visit call that updated `last_seen_at`) in the last **10 minutes**. After **10 minutes with no activity**, the visit is no longer active. Status is derived from the DB at read time (no separate "active" column); the 10-minute window decides it.

**Client:** On app load call `POST /api/track-visit` with `{ "sessionId": "..." }` once; then every **5 minutes** call again with the same sessionId so the visit stays **active** (server uses 10 min inactivity to mark inactive). Do not call for GET /health or dashboard-only pages.

**Server dedupe:** Same sessionId: only update `last_seen_at`. Store `ip_hash` / `ua_hash` only (never raw IP).

## User active now

- **activeUsersNow:** Count distinct `user_id` in `user_presence` where `last_seen_at > now() - 5 minutes`.
- Client sends `POST /api/heartbeat` with `Authorization: Bearer <jwt>` every **60 seconds** while app is open and user is logged in. Server upserts one row per user in `user_presence`.

## Events (activity_events)

- **Types:** `login`, `signup`, `app_open`, `action`. Optional `actionName` (max 128 chars).
- **userId:** Set when request has valid JWT; else null (e.g. signup before login).

**Client:** After login → `POST /api/track-event` `{ "type": "login" }`. After signup → `{ "type": "signup" }`. On app open → `{ "type": "app_open" }`. On actions → `{ "type": "action", "actionName": "..." }`.

## Mapping to dashboard metrics

| Metric | Source |
|--------|--------|
| totalVisitors / totalVisits | count(*) visitor_sessions |
| visitorsNow | count(*) visitor_sessions WHERE last_seen_at > now() - 5 min |
| visitorsToday | count(*) visitor_sessions WHERE date(last_seen_at) = today UTC |
| activeVisits | count(*) visitor_sessions WHERE last_seen_at > now() - 10 min |
| activeUsersNow | count(*) user_presence WHERE last_seen_at > now() - 5 min |
| activityByDay (7d) | activity_events grouped by date(created_at), logins + signups |
| monthlyLogins (6mo) | activity_events event_type=login, group by YYYY-MM |
| dailyActivity (7d) | activity_events grouped by date, logins / appOpens / actions |

## Env

- **Client:** Refresh visit every **5** minutes (so visit stays active within 10 min).
- `ACTIVE_VISIT_TTL_MINUTES` = 10 (server: no activity for 10 min → visit not active).
- `HEARTBEAT_INTERVAL_SECONDS` = 60
- `NOW_TTL_MINUTES` = 5
