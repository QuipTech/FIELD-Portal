-- Section 1b: roles, permissions, and the role/user join tables, plus a
-- starter set of system roles so self-serve registration (0006) has an
-- "Owner" role to assign the first user of a new tenant.

CREATE TABLE IF NOT EXISTS permissions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code         varchar NOT NULL UNIQUE,
  description  varchar,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  row_version  integer NOT NULL DEFAULT 1
);

DROP TRIGGER IF EXISTS trg_permissions_bump_row_version ON permissions;
CREATE TRIGGER trg_permissions_bump_row_version
  BEFORE UPDATE ON permissions
  FOR EACH ROW EXECUTE FUNCTION bump_row_version();

CREATE TABLE IF NOT EXISTS roles (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid REFERENCES tenants(id),
  name            varchar NOT NULL,
  is_system_role  boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  row_version     integer NOT NULL DEFAULT 1,
  deleted_at      timestamptz
);

CREATE INDEX IF NOT EXISTS idx_roles_tenant_id ON roles(tenant_id);

DROP TRIGGER IF EXISTS trg_roles_bump_row_version ON roles;
CREATE TRIGGER trg_roles_bump_row_version
  BEFORE UPDATE ON roles
  FOR EACH ROW EXECUTE FUNCTION bump_row_version();

-- tenant_id IS NULL means a system default role, visible to every tenant.
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS roles_select ON roles;
CREATE POLICY roles_select ON roles
  FOR SELECT USING (tenant_id IS NULL OR tenant_id = current_tenant_id());
DROP POLICY IF EXISTS roles_insert ON roles;
CREATE POLICY roles_insert ON roles
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS roles_update ON roles;
CREATE POLICY roles_update ON roles
  FOR UPDATE USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id        uuid NOT NULL REFERENCES roles(id),
  permission_id  uuid NOT NULL REFERENCES permissions(id),
  tenant_id      uuid REFERENCES tenants(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, permission_id)
);

ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS role_permissions_select ON role_permissions;
CREATE POLICY role_permissions_select ON role_permissions
  FOR SELECT USING (tenant_id IS NULL OR tenant_id = current_tenant_id());
DROP POLICY IF EXISTS role_permissions_insert ON role_permissions;
CREATE POLICY role_permissions_insert ON role_permissions
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());

CREATE TABLE IF NOT EXISTS user_roles (
  user_id     uuid NOT NULL REFERENCES users(id),
  role_id     uuid NOT NULL REFERENCES roles(id),
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_tenant_id ON user_roles(tenant_id);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_roles_select ON user_roles;
CREATE POLICY user_roles_select ON user_roles
  FOR SELECT USING (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS user_roles_insert ON user_roles;
CREATE POLICY user_roles_insert ON user_roles
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());

-- Starter system roles + a small permission set covering the domains in
-- this schema. Extend with more granular codes as features land.
INSERT INTO roles (name, is_system_role, tenant_id) VALUES
  ('Owner', true, NULL),
  ('Technical Manager', true, NULL),
  ('Field Technician', true, NULL),
  ('Knowledge Manager', true, NULL)
ON CONFLICT DO NOTHING;

INSERT INTO permissions (code, description) VALUES
  ('machine.create', 'Register a new machine'),
  ('machine.manage', 'Edit machine records and installed systems'),
  ('knowledge.publish', 'Approve and publish knowledge items'),
  ('knowledge.submit', 'Submit knowledge items for review'),
  ('ai.use', 'Use the AI assistant'),
  ('support.manage', 'Manage support cases'),
  ('admin.manage_users', 'Invite and manage tenant users'),
  ('admin.manage_settings', 'Manage tenant-level settings')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id, tenant_id)
SELECT r.id, p.id, NULL
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Owner' AND r.is_system_role = true
ON CONFLICT DO NOTHING;

INSERT INTO schema_migrations (version)
VALUES ('0004_identity_roles_permissions')
ON CONFLICT (version) DO NOTHING;
