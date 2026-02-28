/**
 * Dashboard stats and user list from Supabase (organizations, accounts, subscriptions).
 * Tracking: visitor_sessions, user_heartbeats, activity_events.
 */
import { createClient } from "@supabase/supabase-js";

let _client = null;
const NOW_TTL_MINUTES = Number(process.env.NOW_TTL_MINUTES) || 5;
/** Minutes without activity after which a visit is no longer "active". Default 10. */
const ACTIVE_VISIT_TTL_MINUTES = Number(process.env.ACTIVE_VISIT_TTL_MINUTES) || 10;

function getSupabase() {
  if (!_client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return null;
    _client = createClient(url, key);
  }
  return _client;
}

function daysLeft(endsAt) {
  if (!endsAt) return null;
  const end = new Date(endsAt);
  const now = new Date();
  const diff = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
  return diff;
}

/** Upsert visitor_sessions by session_id. On conflict only update last_seen_at (preserve first_seen_at). */
export async function upsertVisitorSession(sessionId, ipHash = null, uaHash = null) {
  const supabase = getSupabase();
  if (!supabase) return;
  const now = new Date().toISOString();
  const { data: existing } = await supabase
    .from("visitor_sessions")
    .select("session_id")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (existing) {
    await supabase.from("visitor_sessions").update({ last_seen_at: now }).eq("session_id", sessionId);
  } else {
    await supabase.from("visitor_sessions").insert({
      session_id: sessionId,
      ip_hash: ipHash ?? null,
      ua_hash: uaHash ?? null,
      first_seen_at: now,
      last_seen_at: now,
    });
  }
}

/** Update last_seen_at for user (one row per user in user_presence). */
export async function upsertUserHeartbeat(userId) {
  const supabase = getSupabase();
  if (!supabase) return;
  const now = new Date().toISOString();
  await supabase.from("user_presence").upsert(
    { user_id: userId, last_seen_at: now },
    { onConflict: "user_id" }
  );
}

/** Insert one activity_events row. actionName truncated to 128 chars. */
export async function insertActivityEvent({ userId = null, eventType, actionName = null }) {
  const supabase = getSupabase();
  if (!supabase) return;
  const name = actionName != null ? String(actionName).slice(0, 128) : null;
  await supabase.from("activity_events").insert({
    user_id: userId ?? null,
    event_type: eventType,
    action_name: name || null,
  });
}

/** Visitor counts: total, now (TTL), today UTC, activeVisits (10 min). Uses RPC get_visitor_counts. */
export async function getVisitorCounts() {
  const supabase = getSupabase();
  if (!supabase) return { totalVisitors: 0, totalVisits: 0, visitorsNow: 0, visitorsToday: 0, activeVisits: 0 };
  const { data, error } = await supabase.rpc("get_visitor_counts", {
    ttl_minutes: NOW_TTL_MINUTES,
    active_ttl_minutes: ACTIVE_VISIT_TTL_MINUTES,
  });
  if (error) {
    console.error("[dashboard] get_visitor_counts RPC error:", error.message);
    return { totalVisitors: 0, totalVisits: 0, visitorsNow: 0, visitorsToday: 0, activeVisits: 0 };
  }
  const total = Number(data?.totalVisitors ?? data?.totalVisits ?? 0);
  return {
    totalVisitors: total,
    totalVisits: total,
    visitorsNow: Number(data?.visitorsNow ?? 0),
    visitorsToday: Number(data?.visitorsToday ?? 0),
    activeVisits: Number(data?.activeVisits ?? 0),
  };
}

/** Count distinct users with last_seen_at within TTL (user_presence table). */
export async function getActiveUsersNowCount() {
  const supabase = getSupabase();
  if (!supabase) return 0;
  const now = new Date();
  const ttlMs = NOW_TTL_MINUTES * 60 * 1000;
  const since = new Date(now.getTime() - ttlMs).toISOString();
  const { count } = await supabase.from("user_presence").select("user_id", { count: "exact", head: true }).gte("last_seen_at", since);
  return count ?? 0;
}

/** Last 7 days: date (YYYY-MM-DD), logins, signups. Oldest first. */
export async function getActivityByDay() {
  const supabase = getSupabase();
  if (!supabase) return [];
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const { data } = await supabase
    .from("activity_events")
    .select("event_type, created_at")
    .in("event_type", ["login", "signup"])
    .gte("created_at", sevenDaysAgo.toISOString());
  const byDate = new Map();
  for (let d = 0; d < 7; d++) {
    const dte = new Date(sevenDaysAgo);
    dte.setUTCDate(dte.getUTCDate() + d);
    const key = dte.toISOString().slice(0, 10);
    byDate.set(key, { date: key, logins: 0, signups: 0 });
  }
  for (const row of data ?? []) {
    const key = row.created_at.slice(0, 10);
    if (!byDate.has(key)) byDate.set(key, { date: key, logins: 0, signups: 0 });
    const o = byDate.get(key);
    if (row.event_type === "login") o.logins++;
    else if (row.event_type === "signup") o.signups++;
  }
  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/** Last 6 months: month (YYYY-MM), logins. Newest first. */
export async function getMonthlyLogins() {
  const supabase = getSupabase();
  if (!supabase) return [];
  const now = new Date();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
  const { data } = await supabase
    .from("activity_events")
    .select("created_at")
    .eq("event_type", "login")
    .gte("created_at", sixMonthsAgo.toISOString());
  const byMonth = new Map();
  for (const row of data ?? []) {
    const month = row.created_at.slice(0, 7);
    byMonth.set(month, (byMonth.get(month) ?? 0) + 1);
  }
  return Array.from(byMonth.entries())
    .map(([month, logins]) => ({ month, logins }))
    .sort((a, b) => b.month.localeCompare(a.month))
    .slice(0, 6);
}

/** Last 7 days: date, logins, appOpens, actions. Oldest first. */
export async function getDailyActivity() {
  const supabase = getSupabase();
  if (!supabase) return [];
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const { data } = await supabase
    .from("activity_events")
    .select("event_type, created_at")
    .gte("created_at", sevenDaysAgo.toISOString());
  const byDate = new Map();
  for (let d = 0; d < 7; d++) {
    const dte = new Date(sevenDaysAgo);
    dte.setUTCDate(dte.getUTCDate() + d);
    const key = dte.toISOString().slice(0, 10);
    byDate.set(key, { date: key, logins: 0, appOpens: 0, actions: 0 });
  }
  for (const row of data ?? []) {
    const key = row.created_at.slice(0, 10);
    if (!byDate.has(key)) byDate.set(key, { date: key, logins: 0, appOpens: 0, actions: 0 });
    const o = byDate.get(key);
    if (row.event_type === "login") o.logins++;
    else if (row.event_type === "app_open") o.appOpens++;
    else if (row.event_type === "action") o.actions++;
  }
  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Platform-wide stats for the dashboard overview.
 * Matches Site API spec: totalAccounts, activeSubscriptions, expiredSubscriptions,
 * cancelledSubscriptions, totalOrganizations, planDistribution.
 * totalVisits is added by the route from visits-store.
 * Returns null if Supabase is not configured.
 */
export async function getDashboardStats() {
  const supabase = getSupabase();
  if (!supabase) return null;

  const [orgsRes, accountsRes, subsRes] = await Promise.all([
    supabase.from("organizations").select("id", { count: "exact", head: true }),
    supabase.from("accounts").select("id", { count: "exact", head: true }),
    supabase.from("subscriptions").select("plan, status, ends_at"),
  ]);

  const totalOrganizations = orgsRes?.count ?? 0;
  const totalAccounts = accountsRes?.count ?? 0;
  const subscriptionRows = subsRes?.data ?? [];
  const now = new Date();

  let activeSubscriptions = 0;
  let expiredSubscriptions = 0;
  const cancelledSubscriptions = subscriptionRows.filter((s) => s.status === "cancelled").length;
  const planDistribution = { basic: 0, plus: 0, pro: 0 };

  for (const s of subscriptionRows) {
    const endsAt = s.ends_at ? new Date(s.ends_at) : null;
    const isExpiredByTime = endsAt && endsAt.getTime() <= now.getTime();
    if (s.status === "active" && !isExpiredByTime) {
      activeSubscriptions++;
      if (planDistribution[s.plan] !== undefined) planDistribution[s.plan]++;
    } else if (s.status === "expired" || (s.status === "active" && isExpiredByTime)) {
      expiredSubscriptions++;
    }
  }

  return {
    totalOrganizations,
    totalAccounts,
    activeSubscriptions,
    expiredSubscriptions,
    cancelledSubscriptions,
    planDistribution,
  };
}

/**
 * Full stats object for GET /api/dashboard/stats (visitors, users, subscriptions, analytics).
 * Does not include serverUp/statusText/responseTimeMs/lastCheckAt/appUrl — set in route.
 */
export async function getDashboardStatsFull() {
  const supabase = getSupabase();
  if (!supabase) return null;
  const base = await getDashboardStats();
  if (!base) return null;
  const users = await getDashboardUsers();
  const [visitorCounts, activeUsersNow, activityByDay, monthlyLogins, dailyActivity] = await Promise.all([
    getVisitorCounts(),
    getActiveUsersNowCount(),
    getActivityByDay(),
    getMonthlyLogins(),
    getDailyActivity(),
  ]);
  const totalUsers = users.length;
  const activeUserCount = users.filter((u) => u.status === "active").length;
  const expiredUsers = users.filter((u) => u.status === "expired").length;
  const inactiveUsers = users.filter((u) => u.status === "inactive").length;
  const planDist = base.planDistribution || { basic: 0, plus: 0, pro: 0 };
  const totalPlan = Object.values(planDist).reduce((a, b) => a + b, 0);
  const plansPercentage = totalPlan > 0
    ? Object.fromEntries(Object.entries(planDist).map(([k, v]) => [k, Math.round((v / totalPlan) * 1000) / 10]))
    : { basic: 0, plus: 0, pro: 0 };
  const usersStatusPercentage = totalUsers > 0
    ? {
        active: Math.round((activeUserCount / totalUsers) * 1000) / 10,
        expired: Math.round((expiredUsers / totalUsers) * 1000) / 10,
        inactive: Math.round((inactiveUsers / totalUsers) * 1000) / 10,
      }
    : { active: 0, expired: 0, inactive: 0 };

  return {
    totalVisitors: visitorCounts.totalVisitors,
    totalVisits: visitorCounts.totalVisits ?? visitorCounts.totalVisitors,
    visitorsNow: visitorCounts.visitorsNow,
    visitorsToday: visitorCounts.visitorsToday,
    activeVisits: visitorCounts.activeVisits ?? 0,
    totalUsers,
    activeUsersNow,
    expiredUsers,
    inactiveUsers,
    activeSubscriptions: base.activeSubscriptions,
    expiredSubscriptions: base.expiredSubscriptions,
    cancelledSubscriptions: base.cancelledSubscriptions ?? 0,
    planDistribution: planDist,
    plansPercentage,
    activityByDay,
    monthlyLogins,
    dailyActivity,
    usersStatusPercentage,
  };
}

/**
 * List accounts with org name and subscription for dashboard users table.
 * Matches Site API spec: id, username, displayName, role, plan, status, orgName,
 * createdAt, updatedAt, endsAt, daysLeft. Optional placeholders: phone, city, secretCode, loginCount, employees.
 * Returns [] if Supabase is not configured.
 */
export async function getDashboardUsers() {
  const supabase = getSupabase();
  if (!supabase) return [];

  const [accountsRes, orgsRes, subsRes] = await Promise.all([
    supabase.from("accounts").select("id, org_id, username, display_name, role, created_at, updated_at").order("created_at", { ascending: false }),
    supabase.from("organizations").select("id, name"),
    supabase.from("subscriptions").select("org_id, plan, status, ends_at"),
  ]);

  const accounts = accountsRes?.data ?? [];
  const orgMap = new Map((orgsRes?.data ?? []).map((o) => [o.id, o.name]));
  const subMap = new Map((subsRes?.data ?? []).map((s) => [s.org_id, s]));

  return accounts.map((a) => {
    const sub = subMap.get(a.org_id) || null;
    const endsAt = sub?.ends_at ?? null;
    const dLeft = endsAt ? daysLeft(endsAt) : null;
    let status = "inactive";
    if (sub) {
      if (sub.status === "active") status = dLeft !== null && dLeft <= 0 ? "expired" : "active";
      else if (sub.status === "expired" || sub.status === "cancelled") status = "expired";
    }
    return {
      id: a.id,
      username: a.username,
      displayName: a.display_name || a.username || null,
      role: a.role,
      orgId: a.org_id,
      orgName: orgMap.get(a.org_id) || null,
      plan: sub?.plan ?? "basic",
      status,
      createdAt: a.created_at,
      updatedAt: a.updated_at,
      endsAt: endsAt || null,
      daysLeft: dLeft != null ? dLeft : 0,
      phone: null,
      city: null,
      secretCode: null,
      loginCount: null,
      employees: null,
    };
  });
}

/**
 * Same as getDashboardUsers but with optional status filter and pagination.
 * Returns { users, total }.
 */
export async function getDashboardUsersFiltered({ status = null, limit = 100, offset = 0 } = {}) {
  let users = await getDashboardUsers();
  const total = users.length;
  if (status && ["active", "expired", "inactive"].includes(status)) {
    users = users.filter((u) => u.status === status);
  }
  const cappedLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
  const off = Math.max(Number(offset) || 0, 0);
  return { users: users.slice(off, off + cappedLimit), total };
}
