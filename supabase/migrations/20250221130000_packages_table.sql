-- Packages: data for Packages page. One row per package, scoped by organization.
-- data JSONB stores the full package payload (target, name, speed, validity, price, etc.).

CREATE TABLE packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  target TEXT NOT NULL CHECK (target IN ('subscriber', 'distributor')),
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_packages_org ON packages(org_id);
CREATE INDEX idx_packages_org_target ON packages(org_id, target);

ALTER TABLE packages ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE packages IS 'Packages per organization (subscriber/distributor). Used by Packages page.';
