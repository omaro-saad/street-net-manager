/**
 * Visitor count: Supabase when configured, else in-memory (resets on restart).
 * So the same count is shared across all API instances (e.g. Vercel + local) when using Supabase.
 */
import { createClient } from "@supabase/supabase-js";

let _supabase = null;
let _memoryCount = 0;

function getSupabase() {
  if (_supabase === null) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      _supabase = false;
      return null;
    }
    _supabase = createClient(url, key);
  }
  return _supabase || null;
}

export function getTotalVisits() {
  const supabase = getSupabase();
  if (!supabase) return _memoryCount;
  // Sync read - we need async for Supabase, but getTotalVisits is used synchronously in dashboard route.
  // So we'll make getTotalVisits async in the route, or cache the value. Actually the dashboard route
  // does stats.totalVisits = getTotalVisits() - so getTotalVisits must return a number. So we have two options:
  // 1. Make getTotalVisits async and have the dashboard route await it.
  // 2. Keep a local cache that we update on each increment and periodically refresh from DB.
  // I'll make getTotalVisits async and export getTotalVisitsAsync. Then in the dashboard route we await getTotalVisitsAsync().
  return _memoryCount;
}

/** Async: read from Supabase when configured. */
export async function getTotalVisitsAsync() {
  const supabase = getSupabase();
  if (!supabase) return _memoryCount;
  const { data, error } = await supabase
    .from("site_stats")
    .select("value")
    .eq("key", "total_visits")
    .maybeSingle();
  if (error) return _memoryCount;
  const val = data?.value != null ? Number(data.value) : 0;
  _memoryCount = val;
  return val;
}

export function incrementVisits() {
  const supabase = getSupabase();
  if (!supabase) {
    _memoryCount += 1;
    return _memoryCount;
  }
  // RPC is async; we can't await in a sync handler. So we fire-and-forget the RPC and update local cache when it resolves.
  supabase.rpc("increment_total_visits").then(({ data }) => {
    if (typeof data === "number") _memoryCount = data;
  }).catch(() => {});
  _memoryCount += 1; // optimistic local update so getTotalVisits() is roughly correct before RPC returns
  return _memoryCount;
}
