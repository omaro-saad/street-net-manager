-- Dashboard fix: user_presence table + get_visitor_counts RPC + RLS policies
-- Run once. Safe to re-run (IF NOT EXISTS / CREATE OR REPLACE).

-- 1) user_presence (for heartbeat + activeUsersNow)
CREATE TABLE IF NOT EXISTS public.user_presence (
  user_id UUID PRIMARY KEY REFERENCES public.accounts(id) ON DELETE CASCADE,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_presence_last_seen_at
  ON public.user_presence (last_seen_at);
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.user_presence IS 'One row per user; last heartbeat. activeUsersNow = count where last_seen_at > now() - TTL.';

-- 2) Copy existing data from user_heartbeats if that table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_heartbeats') THEN
    INSERT INTO public.user_presence (user_id, last_seen_at)
    SELECT user_id, last_seen_at FROM public.user_heartbeats
    ON CONFLICT (user_id) DO UPDATE SET last_seen_at = EXCLUDED.last_seen_at;
  END IF;
END $$;

-- 3) Ensure activity_events has event_type (API sends "type"; DB column is event_type)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'activity_events' AND column_name = 'event_type') THEN
    ALTER TABLE public.activity_events ADD COLUMN event_type TEXT;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'activity_events' AND column_name = 'type') THEN
      UPDATE public.activity_events SET event_type = public.activity_events."type" WHERE event_type IS NULL;
      ALTER TABLE public.activity_events DROP COLUMN "type";
    END IF;
    ALTER TABLE public.activity_events ADD CONSTRAINT activity_events_event_type_check
      CHECK (event_type IN ('login', 'signup', 'app_open', 'action'));
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4) Visitor counts via RPC (SECURITY DEFINER so counts work regardless of RLS)
CREATE OR REPLACE FUNCTION public.get_visitor_counts(ttl_minutes int DEFAULT 5)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  since timestamptz;
  today_start timestamptz;
  total bigint;
  now_count bigint;
  today_count bigint;
BEGIN
  since := now() - (ttl_minutes || ' minutes')::interval;
  today_start := date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  SELECT count(*) INTO total FROM public.visitor_sessions;
  SELECT count(*) INTO now_count FROM public.visitor_sessions WHERE last_seen_at > since;
  SELECT count(*) INTO today_count FROM public.visitor_sessions WHERE last_seen_at >= today_start;
  RETURN json_build_object(
    'totalVisitors', total,
    'visitorsNow', now_count,
    'visitorsToday', today_count
  );
END;
$$;
COMMENT ON FUNCTION public.get_visitor_counts(int) IS 'Returns totalVisitors, visitorsNow (TTL), visitorsToday (UTC day).';

-- 5) RLS policies (skip if role service_role does not exist)
DO $$ BEGIN
  CREATE POLICY "service_role_all_visitor_sessions" ON public.visitor_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "service_role_all_user_presence" ON public.user_presence FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "service_role_all_activity_events" ON public.activity_events FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
