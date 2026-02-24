-- App accounts: username/password + secret reset code (hashed). Used for login and CLI-created users.
-- Backend authenticates against this table; service_role has full access.

CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  reset_code_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('oadmin', 'ouser')),
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(username)
);

CREATE INDEX idx_accounts_org ON accounts(org_id);
CREATE INDEX idx_accounts_username ON accounts(LOWER(username));

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

-- Only service_role (backend/CLI) can manage accounts; no anon/authenticated policy so app uses backend JWT.
-- Service role bypasses RLS by default in Supabase.

COMMENT ON TABLE accounts IS 'App login accounts: username, hashed password, hashed 6-digit reset code. Created via CLI or admin.';

-- Ouser module permissions (read/read_write per module)
CREATE TABLE account_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL,
  permission TEXT NOT NULL DEFAULT 'read_write' CHECK (permission IN ('read', 'read_write')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(account_id, module_key)
);

CREATE INDEX idx_account_permissions_account ON account_permissions(account_id);

ALTER TABLE account_permissions ENABLE ROW LEVEL SECURITY;
