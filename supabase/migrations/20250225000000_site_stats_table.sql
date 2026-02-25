-- Site-wide stats (e.g. total visits). Used by GET /api/track-visit and dashboard.
CREATE TABLE IF NOT EXISTS public.site_stats (
  key TEXT PRIMARY KEY,
  value BIGINT NOT NULL DEFAULT 0
);

INSERT INTO public.site_stats (key, value) VALUES ('total_visits', 0)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.site_stats ENABLE ROW LEVEL SECURITY;

-- Service role can do everything; no anon/authenticated policies needed (only backend uses this).
COMMENT ON TABLE public.site_stats IS 'Site-wide counters (total_visits). Backend only.';

-- Atomic increment for total_visits (called by API on each visit).
CREATE OR REPLACE FUNCTION public.increment_total_visits()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE new_val BIGINT;
BEGIN
  UPDATE public.site_stats SET value = value + 1 WHERE key = 'total_visits';
  SELECT value INTO new_val FROM public.site_stats WHERE key = 'total_visits';
  RETURN COALESCE(new_val, 0);
END;
$$;

COMMENT ON FUNCTION public.increment_total_visits() IS 'Increments total_visits in site_stats and returns new value.';
