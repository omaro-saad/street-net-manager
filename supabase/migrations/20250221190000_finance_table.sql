-- Finance: key-value store per organization (_kv: manualInvoices, autoInvoices, etc.).
-- One row per org. data JSONB = the _kv object.

CREATE TABLE finance (
  org_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE finance ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE finance IS 'Finance KV (manualInvoices, autoInvoices, etc.) per organization. Used by Finance page.';
