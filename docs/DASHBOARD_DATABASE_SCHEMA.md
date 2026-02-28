# Admin Dashboard — Database Schema

All timestamps in DB are stored in UTC (use `timestamptz` in Postgres). Tables live in the `public` schema unless noted.

---

## Table: visitor_sessions

Stores one row per unique visitor session (browser session). Used for totalVisitors, visitorsNow, visitorsToday.

| Column         | Type        | Nullable | Description |
|----------------|-------------|----------|-------------|
| id             | uuid        | NO       | Default gen_random_uuid(), PK |
| session_id     | text        | NO       | Client-provided session id (e.g. from localStorage), UNIQUE |
| ip_hash        | text        | YES      | SHA-256 hash of IP + salt (never store raw IP) |
| ua_hash        | text        | YES      | Hash of User-Agent for dedupe |
| first_seen_at  | timestamptz | NO       | First time this session was seen |
| last_seen_at   | timestamptz | NO       | Last time track-visit was called |

**Indexes:**
- UNIQUE on `session_id`
- B-tree on `last_seen_at` (for visitorsNow: `WHERE last_seen_at > now() - interval '5 minutes'`)
- B-tree on `date(last_seen_at AT TIME ZONE 'UTC')` or expression index for visitorsToday if needed

**Relationships:** None. Standalone.

---

## Table: user_heartbeats

One row per user. Updated by POST /api/heartbeat. Used for activeUsersNow.

| Column         | Type        | Nullable | Description |
|----------------|-------------|----------|-------------|
| user_id        | uuid        | NO       | PK, FK to your accounts/users table |
| last_seen_at   | timestamptz | NO       | Last heartbeat time |

**Indexes:**
- PRIMARY KEY on `user_id`
- B-tree on `last_seen_at` (for activeUsersNow: `WHERE last_seen_at > now() - interval '5 minutes'`)

**Relationships:** `user_id` references your existing users/accounts table primary key. On delete of user, cascade or set null as appropriate.

---

## Table: activity_events

One row per event (login, signup, app_open, action). Used for activityByDay, monthlyLogins, dailyActivity.

| Column      | Type        | Nullable | Description |
|-------------|-------------|----------|-------------|
| id          | bigserial   | NO       | PK |
| user_id     | uuid        | YES      | Null for anonymous (e.g. signup before login) |
| event_type  | text        | NO       | One of: login, signup, app_open, action |
| action_name | text        | YES      | Optional, max 128 chars (e.g. "created_subscriber") |
| created_at  | timestamptz | NO       | Default now() |

**Indexes:**
- B-tree on `created_at`
- B-tree on `(event_type, created_at)` for filtered analytics
- B-tree on `date(created_at AT TIME ZONE 'UTC')` or (event_type, date(created_at)) for daily aggregates

**Relationships:** `user_id` references users/accounts if present.

---

## Existing tables (assumed)

Your app already has (or equivalent):

- **accounts / users:** id (uuid), username, display_name, role, org_id, created_at, updated_at, etc.
- **organizations:** id, name, slug, etc.
- **subscriptions:** id, org_id, plan, duration, status, started_at, ends_at, updated_at. status in ('active','expired','cancelled').

Dashboard stats derive:

- totalUsers: count(accounts)
- activeUsersNow: count distinct user_id from user_heartbeats where last_seen_at > now() - 5 minutes
- expiredUsers: count users whose subscription is expired (status = 'expired' or ends_at < now())
- inactiveUsers: define as users not in activeUsersNow and not expired (e.g. no heartbeat in last 30 days and not expired)
- activeSubscriptions: count subscriptions where status = 'active' and ends_at > now()
- expiredSubscriptions: status = 'expired' or ends_at <= now()
- cancelledSubscriptions: status = 'cancelled'

---

## Aggregations (for stats endpoint)

- **totalVisitors:** `SELECT count(*) FROM visitor_sessions`
- **visitorsNow:** `SELECT count(*) FROM visitor_sessions WHERE last_seen_at > now() - interval '5 minutes'`
- **visitorsToday:** `SELECT count(*) FROM visitor_sessions WHERE last_seen_at >= date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'`
- **activityByDay (last 7 days):** group by date(created_at) for event_type in ('login','signup'), sum logins/signups per day
- **monthlyLogins (last 6 months):** group by to_char(created_at, 'YYYY-MM'), event_type = 'login'
- **dailyActivity (last 7 days):** group by date(created_at), count logins, appOpens, actions per day
- **planDistribution:** from subscriptions (active only) group by plan
- **plansPercentage:** planDistribution counts / total active subscriptions * 100
- **usersStatusPercentage:** (active count / total users * 100), (expired count / total * 100), (inactive count / total * 100)

All counts integers; percentages with one decimal.
