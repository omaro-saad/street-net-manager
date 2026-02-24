-- Initial SaaS schema: organizations, org_users, subscriptions, addons, permissions, plan_limits.
-- Matches docs/SAAS_SUBSCRIPTION_DESIGN.md §3.

-- 3.1 Organizations
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_organizations_slug ON organizations(slug);

-- 3.2 Enums for subscriptions
CREATE TYPE plan_tier AS ENUM ('basic', 'plus', 'pro');
CREATE TYPE plan_duration AS ENUM ('monthly', '3months', 'yearly');
CREATE TYPE subscription_status AS ENUM ('pending', 'active', 'expired', 'cancelled');

-- 3.3 Subscriptions
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan plan_tier NOT NULL,
  duration plan_duration NOT NULL,
  status subscription_status NOT NULL DEFAULT 'pending',
  started_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id)
);

CREATE INDEX idx_subscriptions_org ON subscriptions(org_id);
CREATE INDEX idx_subscriptions_status_ends ON subscriptions(org_id, status, ends_at);

-- 3.4 Org users (links Supabase auth.users.id to org + role)
CREATE TABLE org_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  auth_user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('oadmin', 'ouser')),
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, auth_user_id)
);

CREATE INDEX idx_org_users_org ON org_users(org_id);
CREATE INDEX idx_org_users_auth ON org_users(auth_user_id);

-- 3.5 Add-ons (e.g. ouser addon)
CREATE TABLE org_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  addon_key TEXT NOT NULL,
  enabled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, addon_key)
);

CREATE INDEX idx_org_addons_org ON org_addons(org_id);

-- 3.6 Employee permissions (module access per org_user)
CREATE TABLE employee_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_user_id UUID NOT NULL REFERENCES org_users(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL,
  permission TEXT NOT NULL DEFAULT 'read_write' CHECK (permission IN ('read', 'read_write')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_user_id, module_key)
);

CREATE INDEX idx_employee_permissions_org_user ON employee_permissions(org_user_id);

-- 3.7 Plan limits (static config per plan)
CREATE TABLE plan_limits (
  plan plan_tier NOT NULL,
  limit_key TEXT NOT NULL,
  limit_value INT,
  PRIMARY KEY (plan, limit_key)
);

-- Seed plan limits (basic, plus, pro)
INSERT INTO plan_limits (plan, limit_key, limit_value) VALUES
  ('basic', 'subscribers', 15),
  ('basic', 'distributors', 7),
  ('basic', 'lines', 3),
  ('basic', 'maps_enabled', 0),
  ('basic', 'map_nodes_per_line', 0),
  ('basic', 'packages_subscriber', 2),
  ('basic', 'packages_distributor', 2),
  ('basic', 'devices_enabled', 0),
  ('basic', 'devices_stores', 0),
  ('basic', 'employees', 5),
  ('basic', 'finance_manual', 30),
  ('plus', 'subscribers', 30),
  ('plus', 'distributors', 20),
  ('plus', 'lines', 6),
  ('plus', 'maps_enabled', 1),
  ('plus', 'map_nodes_per_line', 10),
  ('plus', 'packages_subscriber', 8),
  ('plus', 'packages_distributor', 8),
  ('plus', 'devices_enabled', 1),
  ('plus', 'devices_stores', 5),
  ('plus', 'employees', 9),
  ('plus', 'finance_manual', 60),
  ('pro', 'subscribers', NULL),
  ('pro', 'distributors', NULL),
  ('pro', 'lines', NULL),
  ('pro', 'maps_enabled', 1),
  ('pro', 'map_nodes_per_line', NULL),
  ('pro', 'packages_subscriber', NULL),
  ('pro', 'packages_distributor', NULL),
  ('pro', 'devices_enabled', 1),
  ('pro', 'devices_stores', NULL),
  ('pro', 'employees', NULL),
  ('pro', 'finance_manual', NULL);

-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_limits ENABLE ROW LEVEL SECURITY;

-- plan_limits: read-only for authenticated users (no org scoping; same for all)
CREATE POLICY "plan_limits_read" ON plan_limits FOR SELECT TO authenticated USING (true);

-- organizations: users can read their own org (via org_users)
CREATE POLICY "organizations_read_own" ON organizations FOR SELECT
  TO authenticated
  USING (
    id IN (SELECT org_id FROM org_users WHERE auth_user_id = auth.uid())
  );

-- org_users: users can read org_users for their org
CREATE POLICY "org_users_read_own_org" ON org_users FOR SELECT
  TO authenticated
  USING (
    org_id IN (SELECT org_id FROM org_users WHERE auth_user_id = auth.uid())
  );

-- subscriptions: read own org
CREATE POLICY "subscriptions_read_own" ON subscriptions FOR SELECT
  TO authenticated
  USING (
    org_id IN (SELECT org_id FROM org_users WHERE auth_user_id = auth.uid())
  );

-- org_addons: read own org
CREATE POLICY "org_addons_read_own" ON org_addons FOR SELECT
  TO authenticated
  USING (
    org_id IN (SELECT org_id FROM org_users WHERE auth_user_id = auth.uid())
  );

-- employee_permissions: read for org's users
CREATE POLICY "employee_permissions_read" ON employee_permissions FOR SELECT
  TO authenticated
  USING (
    org_user_id IN (SELECT id FROM org_users WHERE org_id IN (SELECT org_id FROM org_users WHERE auth_user_id = auth.uid()))
  );
