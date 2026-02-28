-- Admin Dashboard: visitor sessions, user heartbeats, activity events
-- Prerequisites: accounts, organizations, subscriptions exist.

CREATE TABLE IF NOT EXISTS public.visitor_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  ip_hash TEXT,
  ua_hash TEXT,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_visitor_sessions_session_id UNIQUE (session_id)
);

CREATE INDEX IF NOT EXISTS idx_visitor_sessions_last_seen_at
  ON public.visitor_sessions (last_seen_at);

CREATE INDEX IF NOT EXISTS idx_visitor_sessions_last_seen_date
  ON public.visitor_sessions ((date(last_seen_at AT TIME ZONE 'UTC')));

CREATE TABLE IF NOT EXISTS public.user_heartbeats (
  user_id UUID PRIMARY KEY REFERENCES public.accounts(id) ON DELETE CASCADE,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_heartbeats_last_seen_at
  ON public.user_heartbeats (last_seen_at);

CREATE TABLE IF NOT EXISTS public.activity_events (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('login', 'signup', 'app_open', 'action')),
  action_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_events_created_at
  ON public.activity_events (created_at);

CREATE INDEX IF NOT EXISTS idx_activity_events_type_created
  ON public.activity_events (event_type, created_at);

CREATE INDEX IF NOT EXISTS idx_activity_events_date_utc
  ON public.activity_events ((date(created_at AT TIME ZONE 'UTC')));

ALTER TABLE public.visitor_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_heartbeats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;
