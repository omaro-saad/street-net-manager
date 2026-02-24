-- Maps: map data per line per organization (nodes, edges, viewport). Used by MyMap page.
-- One row per (org_id, line_id). line_id is the line UUID or string id from the app.

CREATE TABLE maps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  line_id TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, line_id)
);

CREATE INDEX idx_maps_org ON maps(org_id);
CREATE INDEX idx_maps_org_line ON maps(org_id, line_id);

ALTER TABLE maps ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE maps IS 'Map state per line per organization (nodes, edges, viewport). Used by MyMap page.';
