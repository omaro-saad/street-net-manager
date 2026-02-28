/**
 * Shared subscription logic: duration (full 24h days) and expiration.
 * 1 day = 24 hours. "30 days" at start = 30 full days remaining.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Resolve duration preset or numeric days to a number of days.
 * @param {string} durationRaw - "monthly" | "3months" | "yearly" | numeric string
 * @returns {number} days (30, 90, 365, or parsed number)
 */
export function durationToDays(durationRaw) {
  const d = String(durationRaw ?? "").trim().toLowerCase();
  if (d === "monthly") return 30;
  if (d === "3months") return 90;
  if (d === "yearly") return 365;
  const n = Number(d);
  return Number.isFinite(n) && n >= 0 ? n : 30;
}

/**
 * Add exact full days to a start date (1 day = 24 hours).
 * So "30 days" at start gives 30 full days remaining.
 * @param {string|Date} startDate - ISO string or Date
 * @param {number} days - number of days to add
 * @returns {string} ends_at ISO string
 */
export function addDurationDays(startDate, days) {
  const start = typeof startDate === "string" ? new Date(startDate) : startDate;
  const startMs = start.getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(days) || days < 0) {
    return start.toISOString();
  }
  const endMs = startMs + days * MS_PER_DAY;
  return new Date(endMs).toISOString();
}

/**
 * Time remaining until endsAt as integer (days). null if no endsAt, 0 if expired.
 */
export function getTimeRemainingDays(endsAt) {
  if (!endsAt) return null;
  const end = new Date(endsAt);
  const now = new Date();
  const ms = end - now;
  const days = Math.floor(ms / MS_PER_DAY);
  return days <= 0 ? 0 : days;
}

/**
 * Check if subscription is expired: status not active OR time remaining <= 0.
 * When time remaining reaches 0 (endsAt <= now), subscription is expired — no access, redirect to Subscription Expired page, block all API.
 * 1 day = 24 hours; so "30 days" at start = 30 full days remaining until endsAt.
 * @param {{ status?: string, endsAt?: string | null }} sub - subscription object
 * @returns {boolean}
 */
export function isSubscriptionExpired(sub) {
  if (!sub || sub.status !== "active") return true;
  const endsAt = sub.endsAt ?? sub.ends_at;
  if (endsAt == null) return false;
  const endsAtMs = new Date(endsAt).getTime();
  return Number.isFinite(endsAtMs) && endsAtMs <= Date.now();
}
