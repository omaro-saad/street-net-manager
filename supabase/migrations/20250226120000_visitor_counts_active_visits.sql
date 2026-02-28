-- Add activeVisits to visitor counts (10-minute activity window).
-- A visit is "active" if last_seen_at is within the last 10 minutes (any track-visit updates it).

CREATE OR REPLACE FUNCTION public.get_visitor_counts(ttl_minutes int DEFAULT 5, active_ttl_minutes int DEFAULT 10)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  since timestamptz;
  active_since timestamptz;
  today_start timestamptz;
  total bigint;
  now_count bigint;
  today_count bigint;
  active_count bigint;
BEGIN
  since := now() - (ttl_minutes || ' minutes')::interval;
  active_since := now() - (active_ttl_minutes || ' minutes')::interval;
  today_start := date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  SELECT count(*) INTO total FROM public.visitor_sessions;
  SELECT count(*) INTO now_count FROM public.visitor_sessions WHERE last_seen_at > since;
  SELECT count(*) INTO today_count FROM public.visitor_sessions WHERE last_seen_at >= today_start;
  SELECT count(*) INTO active_count FROM public.visitor_sessions WHERE last_seen_at > active_since;
  RETURN json_build_object(
    'totalVisitors', total,
    'totalVisits', total,
    'visitorsNow', now_count,
    'visitorsToday', today_count,
    'activeVisits', active_count
  );
END;
$$;
COMMENT ON FUNCTION public.get_visitor_counts(int, int) IS 'Returns totalVisitors/totalVisits, visitorsNow (ttl_minutes), visitorsToday (UTC day), activeVisits (active_ttl_minutes). Visit is active if last_seen_at within active_ttl_minutes (default 10).';
