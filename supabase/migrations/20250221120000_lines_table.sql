-- Lines: data for the Lines page. One row per line, scoped by organization.
-- Backend (service_role) reads/writes; app uses JWT + org_id to scope.

CREATE TABLE lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lines_org ON lines(org_id);
CREATE INDEX idx_lines_org_active ON lines(org_id, active);

ALTER TABLE lines ENABLE ROW LEVEL SECURITY;

-- RLS: no direct anon/authenticated access; app uses backend with service_role.
-- Policies can be added later if using Supabase Auth for row-level access.
COMMENT ON TABLE lines IS 'Network lines per organization. Used by Lines page.';
