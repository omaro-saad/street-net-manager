-- Inventory (devices): warehouses, sections, items per organization. One row per org.
-- data JSONB = { warehouses: [], sections: [], items: [] }.

CREATE TABLE inventory (
  org_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{"warehouses":[],"sections":[],"items":[]}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE inventory IS 'Inventory (warehouses, sections, items) per organization. Used by Devices page.';
