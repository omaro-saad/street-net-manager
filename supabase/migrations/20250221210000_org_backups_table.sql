-- Org backups: one row per organization. One backup file (data JSONB) per org; each backup replaces the previous.
-- data = full snapshot (subscribers, distributors, lines, packages, employees, finance, inventory, maps, settings).
-- Linked by org_id (organization). Admin uses backup/restore in Settings.

CREATE TABLE org_backups (
  org_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE org_backups ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE org_backups IS 'One backup snapshot per organization. Replaced on each backup. Used by Settings backup/restore.';
