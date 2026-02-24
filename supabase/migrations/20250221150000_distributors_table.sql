-- Distributors: data for Distributors page. One row per distributor, scoped by organization.
-- data JSONB stores the full distributor payload (name, phone, address, lineId, notes, etc.).

CREATE TABLE distributors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_distributors_org ON distributors(org_id);
CREATE INDEX idx_distributors_org_created ON distributors(org_id, created_at DESC);

ALTER TABLE distributors ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE distributors IS 'Distributors per organization. Used by Distributors page.';
