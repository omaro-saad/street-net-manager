-- =============================================================================
-- Create missing tables: subscribers, distributors, maps
-- =============================================================================
-- Run this in Supabase Dashboard → SQL Editor (New query → paste → Run)
-- when you see: "Could not find the table 'public.subscribers' in the schema cache"
-- (or distributors / maps).
--
-- Prerequisite: table public.organizations must exist (from initial_saas_schema).
-- =============================================================================

-- ========== SUBSCRIBERS ==========
CREATE TABLE IF NOT EXISTS public.subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscribers_org ON public.subscribers(org_id);
CREATE INDEX IF NOT EXISTS idx_subscribers_org_created ON public.subscribers(org_id, created_at DESC);

ALTER TABLE public.subscribers ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.subscribers IS 'Subscribers per organization. Used by Subscribers page.';

-- ========== DISTRIBUTORS ==========
CREATE TABLE IF NOT EXISTS public.distributors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_distributors_org ON public.distributors(org_id);
CREATE INDEX IF NOT EXISTS idx_distributors_org_created ON public.distributors(org_id, created_at DESC);

ALTER TABLE public.distributors ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.distributors IS 'Distributors per organization. Used by Distributors page.';

-- ========== MAPS ==========
CREATE TABLE IF NOT EXISTS public.maps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  line_id TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, line_id)
);

CREATE INDEX IF NOT EXISTS idx_maps_org ON public.maps(org_id);
CREATE INDEX IF NOT EXISTS idx_maps_org_line ON public.maps(org_id, line_id);

ALTER TABLE public.maps ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.maps IS 'Map state per line per organization (nodes, edges, viewport). Used by MyMap page.';

-- ========== EMPLOYEES ==========
CREATE TABLE IF NOT EXISTS public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employees_org ON public.employees(org_id);
CREATE INDEX IF NOT EXISTS idx_employees_org_created ON public.employees(org_id, created_at DESC);

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.employees IS 'Employees per organization. Used by Employees page.';

-- ========== INVENTORY (Devices) ==========
CREATE TABLE IF NOT EXISTS public.inventory (
  org_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{"warehouses":[],"sections":[],"items":[]}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.inventory IS 'Inventory (warehouses, sections, items) per organization. Used by Devices page.';

-- ========== FINANCE ==========
CREATE TABLE IF NOT EXISTS public.finance (
  org_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.finance ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.finance IS 'Finance KV (manualInvoices, autoInvoices, etc.) per organization. Used by Finance page.';
