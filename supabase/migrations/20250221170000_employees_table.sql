-- Employees: data for Employees page. One row per employee, scoped by organization.
-- data JSONB stores the full employee payload (name, phone, payroll, etc.).

CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_employees_org ON employees(org_id);
CREATE INDEX idx_employees_org_created ON employees(org_id, created_at DESC);

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE employees IS 'Employees per organization. Used by Employees page.';
