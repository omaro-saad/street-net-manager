-- Org settings: theme, company name, company about per organization. One row per org.
-- data JSONB = { admin: { theme, companyName, companyAbout } }.

CREATE TABLE org_settings (
  org_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{"admin":{"theme":"light","companyName":"","companyAbout":""}}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE org_settings ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE org_settings IS 'App settings (theme, company name, about) per organization. Used by Settings page.';
