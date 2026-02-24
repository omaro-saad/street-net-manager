-- Subscribers: data for Subscribers page. One row per subscriber, scoped by organization.
-- data JSONB stores the full subscriber payload (name, phone, lineId, serviceId, device, etc.).

CREATE TABLE subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_subscribers_org ON subscribers(org_id);
CREATE INDEX idx_subscribers_org_created ON subscribers(org_id, created_at DESC);

ALTER TABLE subscribers ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE subscribers IS 'Subscribers per organization. Used by Subscribers page.';
