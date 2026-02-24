-- =============================================================================
-- Create missing tables: employees, inventory, finance
-- =============================================================================
-- Run this in Supabase Dashboard → SQL Editor → New query → paste → Run
-- when you see: "Could not find the table 'public.employees' in the schema cache"
-- (or finance / inventory).
--
-- Prerequisite: table public.organizations must exist.
-- =============================================================================

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
