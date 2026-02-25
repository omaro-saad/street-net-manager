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
 * Returns null if Supabase is not configured.
 */
export async function getDashboardStats() {
  const supabase = getSupabase();
  if (!supabase) return null;

  const [orgsRes, accountsRes, subsRes] = await Promise.all([
    supabase.from("organizations").select("id", { count: "exact", head: true }),
    supabase.from("accounts").select("id", { count: "exact", head: true }),
    supabase.from("subscriptions").select("plan, status"),
  ]);

  const totalOrganizations = orgsRes?.count ?? 0;
  const totalAccounts = accountsRes?.count ?? 0;
  const subscriptionRows = subsRes?.data ?? [];

  const activeSubscriptions = subscriptionRows.filter((s) => s.status === "active").length;
  const expiredSubscriptions = subscriptionRows.filter((s) => s.status === "expired").length;
  const cancelledSubscriptions = subscriptionRows.filter((s) => s.status === "cancelled").length;
  const pendingSubscriptions = subscriptionRows.filter((s) => s.status === "pending").length;

  const planDistribution = { basic: 0, plus: 0, pro: 0 };
  subscriptionRows.forEach((s) => {
    if (s.status === "active" && planDistribution[s.plan] !== undefined) {
      planDistribution[s.plan]++;
    }
  });

  return {
    totalOrganizations,
    totalAccounts,
    activeSubscriptions,
    expiredSubscriptions,
    cancelledSubscriptions,
    pendingSubscriptions,
    planDistribution,
    subscriptionStatus: {
      active: activeSubscriptions,
      expired: expiredSubscriptions,
      cancelled: cancelledSubscriptions,
      pending: pendingSubscriptions,
    },
  };
}

/**
 * List accounts with org name and subscription for dashboard users table.
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
      else if (sub.status === "expired") status = "expired";
    }
    return {
      id: a.id,
      orgId: a.org_id,
      username: a.username,
      displayName: a.display_name || a.username,
      role: a.role,
      orgName: orgMap.get(a.org_id) || "",
      plan: sub?.plan ?? null,
      status,
      endsAt,
      daysLeft: dLeft,
      createdAt: a.created_at,
      updatedAt: a.updated_at,
    };
  });
}
