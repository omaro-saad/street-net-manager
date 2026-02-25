/**
 * Dashboard stats and user list from Supabase (organizations, accounts, subscriptions).
 * Used by the dashboard API when SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.
 */
import { createClient } from "@supabase/supabase-js";

let _client = null;

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
      plan: sub?.plan ?? "basic",
      status,
      orgName: orgMap.get(a.org_id) || null,
      createdAt: a.created_at,
      updatedAt: a.updated_at,
      endsAt: endsAt || null,
      daysLeft: dLeft != null ? dLeft : 0,
      // Optional (dashboard shows "—" if missing)
      phone: null,
      city: null,
      secretCode: null,
      loginCount: null,
      employees: null,
    };
  });
}
