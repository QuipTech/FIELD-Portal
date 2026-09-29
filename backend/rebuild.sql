-- ========================================
-- db/migrations/0001_init.sql
-- ========================================
-- FIELD Portal — initial schema bootstrap.
-- Run against quiptech_dev, quiptech_staging, and quiptech_prod (one
-- database per environment, same RDS instance). Safe to re-run.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS schema_migrations (
  version     TEXT PRIMARY KEY,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO schema_migrations (version)
VALUES ('0001_init')
ON CONFLICT (version) DO NOTHING;

-- ========================================
-- db/migrations/0002_extensions_and_app_role.sql
-- ========================================
-- Extensions, shared trigger/helper functions, and the least-privilege
-- application role used by the NestJS backend at runtime.
--
-- Migrations run as the `postgres` superuser (see .env.* DATABASE_URL), so
-- this file can create roles and SECURITY DEFINER functions that bypass RLS.
-- The app itself should NOT run as `postgres` in staging/production — see
-- the ALTER ROLE note at the bottom of this file.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Every RLS policy in this schema checks tenant_id against this function
-- instead of repeating current_setting(...) in every policy. The app sets
-- app.tenant_id once per request/transaction via set_config(...).
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid;
$$;

-- Maintains updated_at and row_version on every UPDATE so individual
-- tables never have to implement this by hand.
CREATE OR REPLACE FUNCTION bump_row_version()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  NEW.row_version := OLD.row_version + 1;
  RETURN NEW;
END;
$$;

-- Least-privilege application role. No hard DELETE (soft delete only, via
-- deleted_at), no DDL, no access to ai_model_configurations beyond SELECT
-- (see 0018_ai_model_config_usage.sql).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'field_app') THEN
    CREATE ROLE field_app LOGIN PASSWORD 'CHANGE_ME_APP_PASSWORD';
  END IF;
END
$$;

DO $$
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO field_app', current_database());
END
$$;

GRANT USAGE ON SCHEMA public TO field_app;

-- Ensures tables created by later migrations are usable by field_app
-- without a manual GRANT in every single migration file.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE ON TABLES TO field_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO field_app;

INSERT INTO schema_migrations (version)
VALUES ('0002_extensions_and_app_role')
ON CONFLICT (version) DO NOTHING;

-- OPERATOR ACTION REQUIRED before deploying past local dev:
--   ALTER ROLE field_app WITH PASSWORD '<a real generated secret>';
-- then point the backend's DATABASE_URL at field_app instead of postgres.

-- ========================================
-- db/migrations/0003_identity_tenants_users.sql
-- ========================================
-- Section 1a: tenants and users (QuipTech_FIELD_Database_Schema, Identity
-- & Access). tenants is the root table and is intentionally NOT row-level
-- secured — there is no tenant context before a tenant exists. Every table
-- from here on that belongs to a tenant gets RLS enabled AND forced.

CREATE TABLE IF NOT EXISTS tenants (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                    varchar NOT NULL,
  slug                    varchar NOT NULL UNIQUE,
  status                  varchar NOT NULL DEFAULT 'trial'
                            CHECK (status IN ('active', 'suspended', 'trial')),
  branding_logo_url       varchar,
  branding_color_primary  varchar,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  row_version             integer NOT NULL DEFAULT 1,
  deleted_at              timestamptz
);

DROP TRIGGER IF EXISTS trg_tenants_bump_row_version ON tenants;
CREATE TRIGGER trg_tenants_bump_row_version
  BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION bump_row_version();

CREATE TABLE IF NOT EXISTS users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  email           varchar NOT NULL UNIQUE,
  password_hash   varchar NOT NULL,
  first_name      varchar NOT NULL,
  last_name       varchar NOT NULL,
  status          varchar NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'invited', 'disabled')),
  last_login_at   timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  row_version     integer NOT NULL DEFAULT 1,
  deleted_at      timestamptz
);

CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);

DROP TRIGGER IF EXISTS trg_users_bump_row_version ON users;
CREATE TRIGGER trg_users_bump_row_version
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION bump_row_version();

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_select ON users;
CREATE POLICY users_select ON users
  FOR SELECT USING (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS users_insert ON users;
CREATE POLICY users_insert ON users
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS users_update ON users;
CREATE POLICY users_update ON users
  FOR UPDATE USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Login happens before the caller has a tenant context (a user only gives
-- an email + password, not which tenant they belong to — email is globally
-- unique so this is safe). This function is owned by the migration role
-- (postgres, a superuser) so it bypasses RLS; only field_app may call it,
-- and it returns nothing beyond what auth needs.
CREATE OR REPLACE FUNCTION auth_lookup_user_by_email(p_email varchar)
RETURNS TABLE (
  id             uuid,
  tenant_id      uuid,
  password_hash  varchar,
  status         varchar,
  first_name     varchar,
  last_name      varchar,
  tenant_status  varchar
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT u.id, u.tenant_id, u.password_hash, u.status,
         u.first_name, u.last_name, t.status AS tenant_status
  FROM users u
  JOIN tenants t ON t.id = u.tenant_id
  WHERE u.email = p_email
    AND u.deleted_at IS NULL;
$$;

REVOKE ALL ON FUNCTION auth_lookup_user_by_email(varchar) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_lookup_user_by_email(varchar) TO field_app;

INSERT INTO schema_migrations (version)
VALUES ('0003_identity_tenants_users')
ON CONFLICT (version) DO NOTHING;

-- ========================================
-- db/migrations/0004_identity_roles_permissions.sql
-- ========================================
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

-- ========================================
-- db/migrations/0005_identity_sessions_devices.sql
-- ========================================
-- Section 1c: sessions (refresh tokens) and device_registrations (push).
-- Both are ephemeral/revocable records, so neither carries deleted_at —
-- a session is invalidated by setting expires_at to now(), not soft-deleted.

CREATE TABLE IF NOT EXISTS sessions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES tenants(id),
  user_id             uuid NOT NULL REFERENCES users(id),
  refresh_token_hash  varchar NOT NULL,
  device_info         varchar,
  ip_address          varchar,
  expires_at          timestamptz NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  row_version         integer NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_sessions_tenant_id ON sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

DROP TRIGGER IF EXISTS trg_sessions_bump_row_version ON sessions;
CREATE TRIGGER trg_sessions_bump_row_version
  BEFORE UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION bump_row_version();

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sessions_select ON sessions;
CREATE POLICY sessions_select ON sessions
  FOR SELECT USING (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS sessions_insert ON sessions;
CREATE POLICY sessions_insert ON sessions
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS sessions_update ON sessions;
CREATE POLICY sessions_update ON sessions
  FOR UPDATE USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE TABLE IF NOT EXISTS device_registrations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id),
  user_id      uuid NOT NULL REFERENCES users(id),
  device_type  varchar NOT NULL CHECK (device_type IN ('ios', 'android', 'web')),
  push_token   varchar NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  row_version  integer NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_device_registrations_tenant_id ON device_registrations(tenant_id);

DROP TRIGGER IF EXISTS trg_device_registrations_bump_row_version ON device_registrations;
CREATE TRIGGER trg_device_registrations_bump_row_version
  BEFORE UPDATE ON device_registrations
  FOR EACH ROW EXECUTE FUNCTION bump_row_version();

ALTER TABLE device_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_registrations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS device_registrations_select ON device_registrations;
CREATE POLICY device_registrations_select ON device_registrations
  FOR SELECT USING (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS device_registrations_insert ON device_registrations;
CREATE POLICY device_registrations_insert ON device_registrations
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS device_registrations_update ON device_registrations;
CREATE POLICY device_registrations_update ON device_registrations
  FOR UPDATE USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

INSERT INTO schema_migrations (version)
VALUES ('0005_identity_sessions_devices')
ON CONFLICT (version) DO NOTHING;

-- ========================================
-- db/migrations/0006_machines_manufacturers_models.sql
-- ========================================
-- Section 2a: the machine admin library (manufacturers/models — shared
-- reference data across all tenants, so no tenant_id/RLS) and the machines
-- table itself (tenant-scoped).

CREATE TABLE IF NOT EXISTS machine_manufacturers (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         varchar NOT NULL UNIQUE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  row_version  integer NOT NULL DEFAULT 1,
  deleted_at   timestamptz
);

DROP TRIGGER IF EXISTS trg_machine_manufacturers_bump_row_version ON machine_manufacturers;
CREATE TRIGGER trg_machine_manufacturers_bump_row_version
  BEFORE UPDATE ON machine_manufacturers
  FOR EACH ROW EXECUTE FUNCTION bump_row_version();

CREATE TABLE IF NOT EXISTS machine_models (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manufacturer_id   uuid NOT NULL REFERENCES machine_manufacturers(id),
  name              varchar NOT NULL,
  product_family    varchar,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  row_version       integer NOT NULL DEFAULT 1,
  deleted_at        timestamptz,
  UNIQUE (manufacturer_id, name)
);

DROP TRIGGER IF EXISTS trg_machine_models_bump_row_version ON machine_models;
CREATE TRIGGER trg_machine_models_bump_row_version
  BEFORE UPDATE ON machine_models
  FOR EACH ROW EXECUTE FUNCTION bump_row_version();

CREATE TABLE IF NOT EXISTS machines (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL REFERENCES tenants(id),
  manufacturer_id       uuid NOT NULL REFERENCES machine_manufacturers(id),
  model_id              uuid NOT NULL REFERENCES machine_models(id),
  serial_number         varchar NOT NULL,
  fleet_number          varchar,
  asset_number          varchar,
  registration_number   varchar,
  status                varchar NOT NULL DEFAULT 'active',
  created_by            uuid NOT NULL REFERENCES users(id),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  row_version           integer NOT NULL DEFAULT 1,
  deleted_at            timestamptz,
  UNIQUE (tenant_id, serial_number)
);

CREATE INDEX IF NOT EXISTS idx_machines_tenant_id ON machines(tenant_id);

DROP TRIGGER IF EXISTS trg_machines_bump_row_version ON machines;
CREATE TRIGGER trg_machines_bump_row_version
  BEFORE UPDATE ON machines
  FOR EACH ROW EXECUTE FUNCTION bump_row_version();

ALTER TABLE machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE machines FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS machines_select ON machines;
CREATE POLICY machines_select ON machines
  FOR SELECT USING (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS machines_insert ON machines;
CREATE POLICY machines_insert ON machines
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS machines_update ON machines;
CREATE POLICY machines_update ON machines
  FOR UPDATE USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

INSERT INTO schema_migrations (version)
VALUES ('0006_machines_manufacturers_models')
ON CONFLICT (version) DO NOTHING;

-- ========================================
-- db/migrations/0007_installed_systems_components.sql
-- ========================================
-- Section 2b: installed_systems/installed_components (the equipment tree
-- hung off a machine) and component_replacement_records (swapped parts).
-- tenant_id is carried directly on each table per the schema doc's
-- invariant ("every tenant-scoped table includes a tenant_id column"),
-- even though the per-table field list only calls out the parent FK.

CREATE TABLE IF NOT EXISTS installed_systems (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id),
  machine_id   uuid NOT NULL REFERENCES machines(id),
  name         varchar NOT NULL,
  description  text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  row_version  integer NOT NULL DEFAULT 1,
  deleted_at   timestamptz
);

CREATE INDEX IF NOT EXISTS idx_installed_systems_tenant_id ON installed_systems(tenant_id);
CREATE INDEX IF NOT EXISTS idx_installed_systems_machine_id ON installed_systems(machine_id);

DROP TRIGGER IF EXISTS trg_installed_systems_bump_row_version ON installed_systems;
CREATE TRIGGER trg_installed_systems_bump_row_version
  BEFORE UPDATE ON installed_systems
  FOR EACH ROW EXECUTE FUNCTION bump_row_version();

ALTER TABLE installed_systems ENABLE ROW LEVEL SECURITY;
ALTER TABLE installed_systems FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS installed_systems_select ON installed_systems;
CREATE POLICY installed_systems_select ON installed_systems
  FOR SELECT USING (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS installed_systems_insert ON installed_systems;
CREATE POLICY installed_systems_insert ON installed_systems
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS installed_systems_update ON installed_systems;
CREATE POLICY installed_systems_update ON installed_systems
  FOR UPDATE USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE TABLE IF NOT EXISTS installed_components (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL REFERENCES tenants(id),
  installed_system_id   uuid NOT NULL REFERENCES installed_systems(id),
  name                  varchar NOT NULL,
  serial_number         varchar,
  firmware_version      varchar,
  software_version      varchar,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  row_version           integer NOT NULL DEFAULT 1,
  deleted_at            timestamptz
);

CREATE INDEX IF NOT EXISTS idx_installed_components_tenant_id ON installed_components(tenant_id);
CREATE INDEX IF NOT EXISTS idx_installed_components_system_id ON installed_components(installed_system_id);

DROP TRIGGER IF EXISTS trg_installed_components_bump_row_version ON installed_components;
CREATE TRIGGER trg_installed_components_bump_row_version
  BEFORE UPDATE ON installed_components
  FOR EACH ROW EXECUTE FUNCTION bump_row_version();

ALTER TABLE installed_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE installed_components FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS installed_components_select ON installed_components;
CREATE POLICY installed_components_select ON installed_components
  FOR SELECT USING (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS installed_components_insert ON installed_components;
CREATE POLICY installed_components_insert ON installed_components
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS installed_components_update ON installed_components;
CREATE POLICY installed_components_update ON installed_components
  FOR UPDATE USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE TABLE IF NOT EXISTS component_replacement_records (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               uuid NOT NULL REFERENCES tenants(id),
  installed_component_id  uuid NOT NULL REFERENCES installed_components(id),
  old_serial_number       varchar,
  new_serial_number       varchar,
  replaced_by             uuid NOT NULL REFERENCES users(id),
  reason                  text,
  replaced_at             timestamptz NOT NULL DEFAULT now(),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  row_version             integer NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_component_replacement_records_tenant_id ON component_replacement_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_component_replacement_records_component_id ON component_replacement_records(installed_component_id);

DROP TRIGGER IF EXISTS trg_component_replacement_records_bump_row_version ON component_replacement_records;
CREATE TRIGGER trg_component_replacement_records_bump_row_version
  BEFORE UPDATE ON component_replacement_records
  FOR EACH ROW EXECUTE FUNCTION bump_row_version();

ALTER TABLE component_replacement_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE component_replacement_records FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS component_replacement_records_select ON component_replacement_records;
CREATE POLICY component_replacement_records_select ON component_replacement_records
  FOR SELECT USING (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS component_replacement_records_insert ON component_replacement_records;
CREATE POLICY component_replacement_records_insert ON component_replacement_records
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());

INSERT INTO schema_migrations (version)
VALUES ('0007_installed_systems_components')
ON CONFLICT (version) DO NOTHING;

-- ========================================
-- db/migrations/0008_technical_history.sql
-- ========================================
-- Section 2c: technical_history_entries (append-only; corrections are
-- stored as amendments, never edited in place) and technical_attachments.

CREATE TABLE IF NOT EXISTS technical_history_entries (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES tenants(id),
  machine_id          uuid NOT NULL REFERENCES machines(id),
  entry_type          varchar NOT NULL
                        CHECK (entry_type IN ('service', 'repair', 'inspection', 'note')),
  description         text NOT NULL,
  created_by          uuid NOT NULL REFERENCES users(id),
  is_amendment        boolean NOT NULL DEFAULT false,
  original_entry_id   uuid REFERENCES technical_history_entries(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  row_version         integer NOT NULL DEFAULT 1,
  deleted_at          timestamptz
);

CREATE INDEX IF NOT EXISTS idx_technical_history_entries_tenant_id ON technical_history_entries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_technical_history_entries_machine_id ON technical_history_entries(machine_id);

DROP TRIGGER IF EXISTS trg_technical_history_entries_bump_row_version ON technical_history_entries;
CREATE TRIGGER trg_technical_history_entries_bump_row_version
  BEFORE UPDATE ON technical_history_entries
  FOR EACH ROW EXECUTE FUNCTION bump_row_version();

ALTER TABLE technical_history_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE technical_history_entries FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS technical_history_entries_select ON technical_history_entries;
CREATE POLICY technical_history_entries_select ON technical_history_entries
  FOR SELECT USING (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS technical_history_entries_insert ON technical_history_entries;
CREATE POLICY technical_history_entries_insert ON technical_history_entries
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());

CREATE TABLE IF NOT EXISTS technical_attachments (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL REFERENCES tenants(id),
  history_entry_id   uuid NOT NULL REFERENCES technical_history_entries(id),
  file_url           varchar NOT NULL,
  file_type          varchar NOT NULL
                        CHECK (file_type IN ('photo', 'video', 'voice_note', 'document')),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  row_version        integer NOT NULL DEFAULT 1,
  deleted_at         timestamptz
);

CREATE INDEX IF NOT EXISTS idx_technical_attachments_tenant_id ON technical_attachments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_technical_attachments_history_entry_id ON technical_attachments(history_entry_id);

DROP TRIGGER IF EXISTS trg_technical_attachments_bump_row_version ON technical_attachments;
CREATE TRIGGER trg_technical_attachments_bump_row_version
  BEFORE UPDATE ON technical_attachments
  FOR EACH ROW EXECUTE FUNCTION bump_row_version();

ALTER TABLE technical_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE technical_attachments FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS technical_attachments_select ON technical_attachments;
CREATE POLICY technical_attachments_select ON technical_attachments
  FOR SELECT USING (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS technical_attachments_insert ON technical_attachments;
CREATE POLICY technical_attachments_insert ON technical_attachments
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());

INSERT INTO schema_migrations (version)
VALUES ('0008_technical_history')
ON CONFLICT (version) DO NOTHING;

-- ========================================
-- db/migrations/0009_configuration_snapshots.sql
-- ========================================
-- Section 2d: configuration_snapshots/configuration_snapshot_items —
-- point-in-time machine configuration. The capture/diff functions that
-- operate on these tables live in 0010, kept separate to stay under the
-- 200-line-per-file convention.

CREATE TABLE IF NOT EXISTS configuration_snapshots (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id),
  machine_id   uuid NOT NULL REFERENCES machines(id),
  taken_at     timestamptz NOT NULL DEFAULT now(),
  taken_by     uuid REFERENCES users(id),
  trigger      varchar NOT NULL
                 CHECK (trigger IN ('manual', 'service', 'component_replaced', 'scheduled', 'baseline')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  row_version  integer NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_configuration_snapshots_tenant_id ON configuration_snapshots(tenant_id);
CREATE INDEX IF NOT EXISTS idx_configuration_snapshots_machine_id ON configuration_snapshots(machine_id);

DROP TRIGGER IF EXISTS trg_configuration_snapshots_bump_row_version ON configuration_snapshots;
CREATE TRIGGER trg_configuration_snapshots_bump_row_version
  BEFORE UPDATE ON configuration_snapshots
  FOR EACH ROW EXECUTE FUNCTION bump_row_version();

ALTER TABLE configuration_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuration_snapshots FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS configuration_snapshots_select ON configuration_snapshots;
CREATE POLICY configuration_snapshots_select ON configuration_snapshots
  FOR SELECT USING (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS configuration_snapshots_insert ON configuration_snapshots;
CREATE POLICY configuration_snapshots_insert ON configuration_snapshots
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());

CREATE TABLE IF NOT EXISTS configuration_snapshot_items (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL REFERENCES tenants(id),
  snapshot_id        uuid NOT NULL REFERENCES configuration_snapshots(id),
  system_name        varchar NOT NULL,
  component_name     varchar NOT NULL,
  serial_number      varchar,
  firmware_version   varchar,
  software_version   varchar,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_configuration_snapshot_items_tenant_id ON configuration_snapshot_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_configuration_snapshot_items_snapshot_id ON configuration_snapshot_items(snapshot_id);

ALTER TABLE configuration_snapshot_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuration_snapshot_items FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS configuration_snapshot_items_select ON configuration_snapshot_items;
CREATE POLICY configuration_snapshot_items_select ON configuration_snapshot_items
  FOR SELECT USING (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS configuration_snapshot_items_insert ON configuration_snapshot_items;
CREATE POLICY configuration_snapshot_items_insert ON configuration_snapshot_items
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());

INSERT INTO schema_migrations (version)
VALUES ('0009_configuration_snapshots')
ON CONFLICT (version) DO NOTHING;

-- ========================================
-- db/migrations/0010_configuration_snapshot_functions.sql
-- ========================================
-- Section 2e: capture_configuration_snapshot() and
-- diff_configuration_snapshots(), as named in the schema doc. Both run
-- SECURITY INVOKER (the default) — RLS applies normally using whatever
-- tenant context the caller already set via set_config('app.tenant_id', ...).

CREATE OR REPLACE FUNCTION capture_configuration_snapshot(
  p_machine_id  uuid,
  p_taken_by    uuid,
  p_trigger     varchar
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_snapshot_id uuid;
BEGIN
  INSERT INTO configuration_snapshots (tenant_id, machine_id, taken_by, trigger)
  VALUES (current_tenant_id(), p_machine_id, p_taken_by, p_trigger)
  RETURNING id INTO v_snapshot_id;

  INSERT INTO configuration_snapshot_items (
    tenant_id, snapshot_id, system_name, component_name,
    serial_number, firmware_version, software_version
  )
  SELECT current_tenant_id(), v_snapshot_id, s.name, c.name,
         c.serial_number, c.firmware_version, c.software_version
  FROM installed_systems s
  JOIN installed_components c ON c.installed_system_id = s.id
  WHERE s.machine_id = p_machine_id
    AND s.deleted_at IS NULL
    AND c.deleted_at IS NULL;

  RETURN v_snapshot_id;
END;
$$;

CREATE OR REPLACE FUNCTION diff_configuration_snapshots(
  p_snapshot_id_a  uuid,
  p_snapshot_id_b  uuid
)
RETURNS TABLE (
  system_name     varchar,
  component_name  varchar,
  change_type     varchar,
  field_name      varchar,
  old_value       varchar,
  new_value       varchar
)
LANGUAGE sql
STABLE
AS $$
  WITH a AS (
    SELECT * FROM configuration_snapshot_items WHERE snapshot_id = p_snapshot_id_a
  ),
  b AS (
    SELECT * FROM configuration_snapshot_items WHERE snapshot_id = p_snapshot_id_b
  ),
  matched AS (
    SELECT
      COALESCE(a.system_name, b.system_name) AS system_name,
      COALESCE(a.component_name, b.component_name) AS component_name,
      a.serial_number AS old_serial_number, b.serial_number AS new_serial_number,
      a.firmware_version AS old_firmware_version, b.firmware_version AS new_firmware_version,
      a.software_version AS old_software_version, b.software_version AS new_software_version,
      (a.component_name IS NULL) AS is_added,
      (b.component_name IS NULL) AS is_removed
    FROM a
    FULL OUTER JOIN b
      ON a.system_name = b.system_name AND a.component_name = b.component_name
  )
  SELECT matched.system_name, matched.component_name,
         CASE WHEN is_added THEN 'added' WHEN is_removed THEN 'removed' ELSE 'changed' END,
         fields.field_name, fields.old_value, fields.new_value
  FROM matched
  CROSS JOIN LATERAL (
    VALUES
      ('serial_number', old_serial_number, new_serial_number),
      ('firmware_version', old_firmware_version, new_firmware_version),
      ('software_version', old_software_version, new_software_version)
  ) AS fields(field_name, old_value, new_value)
  WHERE is_added OR is_removed OR old_value IS DISTINCT FROM new_value;
$$;

INSERT INTO schema_migrations (version)
VALUES ('0010_configuration_snapshot_functions')
ON CONFLICT (version) DO NOTHING;

-- ========================================
-- db/migrations/0011_knowledge_items.sql
-- ========================================
-- Section 3a: knowledge_items, with the licensing metadata added in the
-- Milestone 1 review corrections. resolution_record_id points at
-- resolution_records, created later in this section (0014) — the FK
-- constraint is added there once that table exists, to avoid a forward
-- reference within the migration sequence.

CREATE TABLE IF NOT EXISTS knowledge_items (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            uuid NOT NULL REFERENCES tenants(id),
  title                varchar NOT NULL,
  type                 varchar NOT NULL
                         CHECK (type IN ('document', 'known_issue', 'troubleshooting_guide', 'bulletin', 'resolution')),
  status               varchar NOT NULL DEFAULT 'draft'
                         CHECK (status IN ('draft', 'review', 'approved', 'published', 'archived', 'withdrawn')),
  source_type          varchar NOT NULL
                         CHECK (source_type IN ('oem', 'internal', 'resolution')),
  source_oem           varchar,
  licence_scope        varchar CHECK (licence_scope IN ('site', 'fleet', 'tenant')),
  permitted_use        varchar
                         CHECK (permitted_use IN ('internal_reference', 'ai_retrieval', 'ai_retrieval_and_display')),
  licence_expires_at   timestamptz,
  licence_reference    varchar,
  resolution_record_id uuid,
  created_by           uuid NOT NULL REFERENCES users(id),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  row_version          integer NOT NULL DEFAULT 1,
  deleted_at           timestamptz,
  CONSTRAINT knowledge_items_oem_licence_fields CHECK (
    source_type <> 'oem'
    OR (licence_expires_at IS NOT NULL AND licence_reference IS NOT NULL)
  ),
  CONSTRAINT knowledge_items_resolution_requires_record CHECK (
    type <> 'resolution' OR resolution_record_id IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_knowledge_items_tenant_id ON knowledge_items(tenant_id);

DROP TRIGGER IF EXISTS trg_knowledge_items_bump_row_version ON knowledge_items;
CREATE TRIGGER trg_knowledge_items_bump_row_version
  BEFORE UPDATE ON knowledge_items
  FOR EACH ROW EXECUTE FUNCTION bump_row_version();

ALTER TABLE knowledge_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_items FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS knowledge_items_select ON knowledge_items;
CREATE POLICY knowledge_items_select ON knowledge_items
  FOR SELECT USING (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS knowledge_items_insert ON knowledge_items;
CREATE POLICY knowledge_items_insert ON knowledge_items
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS knowledge_items_update ON knowledge_items;
CREATE POLICY knowledge_items_update ON knowledge_items
  FOR UPDATE USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

INSERT INTO schema_migrations (version)
VALUES ('0011_knowledge_items')
ON CONFLICT (version) DO NOTHING;

-- ========================================
-- db/migrations/0012_knowledge_documents.sql
-- ========================================
-- Section 3b: documents/document_versions — versioned file storage with
-- an ingestion state machine (pending -> parsing -> chunking -> embedding
-- -> ready, or failed).

CREATE TABLE IF NOT EXISTS documents (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES tenants(id),
  knowledge_item_id   uuid NOT NULL REFERENCES knowledge_items(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  row_version         integer NOT NULL DEFAULT 1,
  deleted_at          timestamptz
);

CREATE INDEX IF NOT EXISTS idx_documents_tenant_id ON documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_documents_knowledge_item_id ON documents(knowledge_item_id);

DROP TRIGGER IF EXISTS trg_documents_bump_row_version ON documents;
CREATE TRIGGER trg_documents_bump_row_version
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION bump_row_version();

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS documents_select ON documents;
CREATE POLICY documents_select ON documents
  FOR SELECT USING (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS documents_insert ON documents;
CREATE POLICY documents_insert ON documents
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS documents_update ON documents;
CREATE POLICY documents_update ON documents
  FOR UPDATE USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE TABLE IF NOT EXISTS document_versions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL REFERENCES tenants(id),
  document_id        uuid NOT NULL REFERENCES documents(id),
  file_url           varchar NOT NULL,
  version_number     integer NOT NULL,
  uploaded_by        uuid NOT NULL REFERENCES users(id),
  ingestion_status   varchar NOT NULL DEFAULT 'pending'
                       CHECK (ingestion_status IN ('pending', 'parsing', 'chunking', 'embedding', 'ready', 'failed')),
  ingested_at        timestamptz,
  content_sha256     varchar,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  row_version        integer NOT NULL DEFAULT 1,
  UNIQUE (document_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_document_versions_tenant_id ON document_versions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_document_versions_document_id ON document_versions(document_id);
-- content_sha256 lookups skip re-processing an identical re-upload.
CREATE INDEX IF NOT EXISTS idx_document_versions_content_sha256 ON document_versions(content_sha256);

DROP TRIGGER IF EXISTS trg_document_versions_bump_row_version ON document_versions;
CREATE TRIGGER trg_document_versions_bump_row_version
  BEFORE UPDATE ON document_versions
  FOR EACH ROW EXECUTE FUNCTION bump_row_version();

ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_versions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS document_versions_select ON document_versions;
CREATE POLICY document_versions_select ON document_versions
  FOR SELECT USING (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS document_versions_insert ON document_versions;
CREATE POLICY document_versions_insert ON document_versions
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS document_versions_update ON document_versions;
CREATE POLICY document_versions_update ON document_versions
  FOR UPDATE USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

INSERT INTO schema_migrations (version)
VALUES ('0012_knowledge_documents')
ON CONFLICT (version) DO NOTHING;

-- ========================================
-- db/migrations/0013_knowledge_chunks.sql
-- ========================================
-- Section 3c: document_chunks — powers AI semantic search. Citations are
-- version-specific (document_version_id, not just document_id) with real
-- anchors (page/section + character offsets) so a citation survives
-- re-ingestion of a later version.

CREATE TABLE IF NOT EXISTS document_chunks (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                uuid NOT NULL REFERENCES tenants(id),
  document_id              uuid NOT NULL REFERENCES documents(id),
  document_version_id      uuid NOT NULL REFERENCES document_versions(id),
  chunk_text               text NOT NULL,
  embedding                vector(1024) NOT NULL,
  page_number              integer,
  section_heading          varchar,
  char_start               integer,
  char_end                 integer,
  chunk_index              integer NOT NULL,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  row_version               integer NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_document_chunks_tenant_id ON document_chunks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_document_version_id ON document_chunks(document_version_id);

-- Titan Text Embeddings V2 on Bedrock, dimension fixed at 1024.
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding_hnsw
  ON document_chunks USING hnsw (embedding vector_cosine_ops);

DROP TRIGGER IF EXISTS trg_document_chunks_bump_row_version ON document_chunks;
CREATE TRIGGER trg_document_chunks_bump_row_version
  BEFORE UPDATE ON document_chunks
  FOR EACH ROW EXECUTE FUNCTION bump_row_version();

ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS document_chunks_select ON document_chunks;
CREATE POLICY document_chunks_select ON document_chunks
  FOR SELECT USING (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS document_chunks_insert ON document_chunks;
CREATE POLICY document_chunks_insert ON document_chunks
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());

INSERT INTO schema_migrations (version)
VALUES ('0013_knowledge_chunks')
ON CONFLICT (version) DO NOTHING;

-- ========================================
-- db/migrations/0014_knowledge_resolution_records.sql
-- ========================================
-- Section 3d: resolution_records — the only path from an AI conversation
-- into published knowledge. conversation_id references ai_conversations,
-- which doesn't exist until Section 4 (0015_ai_conversations_messages.sql)
-- — that migration adds the FK once both tables exist. Here we also close
-- the loop on knowledge_items.resolution_record_id from 0011.

CREATE TABLE IF NOT EXISTS resolution_records (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL REFERENCES tenants(id),
  conversation_id    uuid,
  machine_id         uuid REFERENCES machines(id),
  problem_summary    text NOT NULL,
  root_cause         text,
  resolution_steps   text,
  authored_by        uuid NOT NULL REFERENCES users(id),
  status             varchar NOT NULL DEFAULT 'draft'
                       CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
  approved_by        uuid REFERENCES users(id),
  approved_at        timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  row_version        integer NOT NULL DEFAULT 1,
  CONSTRAINT resolution_records_approval_set_together CHECK (
    (approved_by IS NULL) = (approved_at IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_resolution_records_tenant_id ON resolution_records(tenant_id);

DROP TRIGGER IF EXISTS trg_resolution_records_bump_row_version ON resolution_records;
CREATE TRIGGER trg_resolution_records_bump_row_version
  BEFORE UPDATE ON resolution_records
  FOR EACH ROW EXECUTE FUNCTION bump_row_version();

ALTER TABLE resolution_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE resolution_records FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS resolution_records_select ON resolution_records;
CREATE POLICY resolution_records_select ON resolution_records
  FOR SELECT USING (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS resolution_records_insert ON resolution_records;
CREATE POLICY resolution_records_insert ON resolution_records
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS resolution_records_update ON resolution_records;
CREATE POLICY resolution_records_update ON resolution_records
  FOR UPDATE USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_knowledge_items_resolution_record'
  ) THEN
    ALTER TABLE knowledge_items
      ADD CONSTRAINT fk_knowledge_items_resolution_record
      FOREIGN KEY (resolution_record_id) REFERENCES resolution_records(id);
  END IF;
END
$$;

INSERT INTO schema_migrations (version)
VALUES ('0014_knowledge_resolution_records')
ON CONFLICT (version) DO NOTHING;

-- ========================================
-- db/migrations/0015_knowledge_review_feedback.sql
-- ========================================
-- Section 3e: review_queue_items (approval workflow queue for knowledge
-- submissions) and knowledge_feedback (technician feedback on published
-- knowledge).

CREATE TABLE IF NOT EXISTS review_queue_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES tenants(id),
  knowledge_item_id   uuid NOT NULL REFERENCES knowledge_items(id),
  submitted_by        uuid NOT NULL REFERENCES users(id),
  reviewed_by         uuid REFERENCES users(id),
  status              varchar NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  row_version         integer NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_review_queue_items_tenant_id ON review_queue_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_review_queue_items_knowledge_item_id ON review_queue_items(knowledge_item_id);

DROP TRIGGER IF EXISTS trg_review_queue_items_bump_row_version ON review_queue_items;
CREATE TRIGGER trg_review_queue_items_bump_row_version
  BEFORE UPDATE ON review_queue_items
  FOR EACH ROW EXECUTE FUNCTION bump_row_version();

ALTER TABLE review_queue_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_queue_items FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS review_queue_items_select ON review_queue_items;
CREATE POLICY review_queue_items_select ON review_queue_items
  FOR SELECT USING (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS review_queue_items_insert ON review_queue_items;
CREATE POLICY review_queue_items_insert ON review_queue_items
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS review_queue_items_update ON review_queue_items;
CREATE POLICY review_queue_items_update ON review_queue_items
  FOR UPDATE USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE TABLE IF NOT EXISTS knowledge_feedback (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES tenants(id),
  knowledge_item_id   uuid NOT NULL REFERENCES knowledge_items(id),
  user_id             uuid NOT NULL REFERENCES users(id),
  rating              varchar NOT NULL,
  comment             text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  row_version         integer NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_knowledge_feedback_tenant_id ON knowledge_feedback(tenant_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_feedback_knowledge_item_id ON knowledge_feedback(knowledge_item_id);

DROP TRIGGER IF EXISTS trg_knowledge_feedback_bump_row_version ON knowledge_feedback;
CREATE TRIGGER trg_knowledge_feedback_bump_row_version
  BEFORE UPDATE ON knowledge_feedback
  FOR EACH ROW EXECUTE FUNCTION bump_row_version();

ALTER TABLE knowledge_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_feedback FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS knowledge_feedback_select ON knowledge_feedback;
CREATE POLICY knowledge_feedback_select ON knowledge_feedback
  FOR SELECT USING (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS knowledge_feedback_insert ON knowledge_feedback;
CREATE POLICY knowledge_feedback_insert ON knowledge_feedback
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());

INSERT INTO schema_migrations (version)
VALUES ('0015_knowledge_review_feedback')
ON CONFLICT (version) DO NOTHING;

-- ========================================
-- db/migrations/0016_ai_conversations_messages.sql
-- ========================================
-- Section 4a: ai_conversations, ai_messages. Also closes the forward
-- reference left open in 0014: resolution_records.conversation_id now
-- has somewhere to point.

CREATE TABLE IF NOT EXISTS ai_conversations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id),
  user_id      uuid NOT NULL REFERENCES users(id),
  machine_id   uuid REFERENCES machines(id),
  title        varchar,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  row_version  integer NOT NULL DEFAULT 1,
  deleted_at   timestamptz
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_tenant_id ON ai_conversations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_id ON ai_conversations(user_id);

DROP TRIGGER IF EXISTS trg_ai_conversations_bump_row_version ON ai_conversations;
CREATE TRIGGER trg_ai_conversations_bump_row_version
  BEFORE UPDATE ON ai_conversations
  FOR EACH ROW EXECUTE FUNCTION bump_row_version();

ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_conversations_select ON ai_conversations;
CREATE POLICY ai_conversations_select ON ai_conversations
  FOR SELECT USING (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS ai_conversations_insert ON ai_conversations;
CREATE POLICY ai_conversations_insert ON ai_conversations
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS ai_conversations_update ON ai_conversations;
CREATE POLICY ai_conversations_update ON ai_conversations
  FOR UPDATE USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_resolution_records_conversation'
  ) THEN
    ALTER TABLE resolution_records
      ADD CONSTRAINT fk_resolution_records_conversation
      FOREIGN KEY (conversation_id) REFERENCES ai_conversations(id);
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS ai_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  conversation_id uuid NOT NULL REFERENCES ai_conversations(id),
  role            varchar NOT NULL CHECK (role IN ('user', 'assistant')),
  content         text NOT NULL,
  model_used      varchar,
  prompt_version  varchar,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  row_version     integer NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_ai_messages_tenant_id ON ai_messages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation_id ON ai_messages(conversation_id);

ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_messages FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_messages_select ON ai_messages;
CREATE POLICY ai_messages_select ON ai_messages
  FOR SELECT USING (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS ai_messages_insert ON ai_messages;
CREATE POLICY ai_messages_insert ON ai_messages
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());

INSERT INTO schema_migrations (version)
VALUES ('0016_ai_conversations_messages')
ON CONFLICT (version) DO NOTHING;

-- ========================================
-- db/migrations/0017_ai_references_feedback.sql
-- ========================================
-- Section 4b: ai_source_references (chunk_id is now required, not
-- optional — it points to the exact chunk, not just the document) and
-- ai_feedback.

CREATE TABLE IF NOT EXISTS ai_source_references (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id),
  message_id       uuid NOT NULL REFERENCES ai_messages(id),
  chunk_id         uuid NOT NULL REFERENCES document_chunks(id),
  page_number      integer,
  section_heading  varchar,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_source_references_tenant_id ON ai_source_references(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_source_references_message_id ON ai_source_references(message_id);

ALTER TABLE ai_source_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_source_references FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_source_references_select ON ai_source_references;
CREATE POLICY ai_source_references_select ON ai_source_references
  FOR SELECT USING (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS ai_source_references_insert ON ai_source_references;
CREATE POLICY ai_source_references_insert ON ai_source_references
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());

CREATE TABLE IF NOT EXISTS ai_feedback (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id),
  message_id   uuid NOT NULL REFERENCES ai_messages(id),
  rating       varchar NOT NULL,
  comment      text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  row_version  integer NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_ai_feedback_tenant_id ON ai_feedback(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_message_id ON ai_feedback(message_id);

DROP TRIGGER IF EXISTS trg_ai_feedback_bump_row_version ON ai_feedback;
CREATE TRIGGER trg_ai_feedback_bump_row_version
  BEFORE UPDATE ON ai_feedback
  FOR EACH ROW EXECUTE FUNCTION bump_row_version();

ALTER TABLE ai_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_feedback FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_feedback_select ON ai_feedback;
CREATE POLICY ai_feedback_select ON ai_feedback
  FOR SELECT USING (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS ai_feedback_insert ON ai_feedback;
CREATE POLICY ai_feedback_insert ON ai_feedback
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());

INSERT INTO schema_migrations (version)
VALUES ('0017_ai_references_feedback')
ON CONFLICT (version) DO NOTHING;

-- ========================================
-- db/migrations/0018_ai_review_escalations.sql
-- ========================================
-- Section 4c: ai_review_items (admin review queue) and ai_escalations
-- (escalation tracking).

CREATE TABLE IF NOT EXISTS ai_review_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id),
  message_id   uuid NOT NULL REFERENCES ai_messages(id),
  status       varchar NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed')),
  reason       text,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  row_version  integer NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_ai_review_items_tenant_id ON ai_review_items(tenant_id);

DROP TRIGGER IF EXISTS trg_ai_review_items_bump_row_version ON ai_review_items;
CREATE TRIGGER trg_ai_review_items_bump_row_version
  BEFORE UPDATE ON ai_review_items
  FOR EACH ROW EXECUTE FUNCTION bump_row_version();

ALTER TABLE ai_review_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_review_items FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_review_items_select ON ai_review_items;
CREATE POLICY ai_review_items_select ON ai_review_items
  FOR SELECT USING (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS ai_review_items_insert ON ai_review_items;
CREATE POLICY ai_review_items_insert ON ai_review_items
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS ai_review_items_update ON ai_review_items;
CREATE POLICY ai_review_items_update ON ai_review_items
  FOR UPDATE USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE TABLE IF NOT EXISTS ai_escalations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id),
  conversation_id  uuid NOT NULL REFERENCES ai_conversations(id),
  escalated_by     uuid NOT NULL REFERENCES users(id),
  escalated_to     uuid REFERENCES users(id),
  status           varchar NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed')),
  reason           text,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  row_version      integer NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_ai_escalations_tenant_id ON ai_escalations(tenant_id);

DROP TRIGGER IF EXISTS trg_ai_escalations_bump_row_version ON ai_escalations;
CREATE TRIGGER trg_ai_escalations_bump_row_version
  BEFORE UPDATE ON ai_escalations
  FOR EACH ROW EXECUTE FUNCTION bump_row_version();

ALTER TABLE ai_escalations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_escalations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_escalations_select ON ai_escalations;
CREATE POLICY ai_escalations_select ON ai_escalations
  FOR SELECT USING (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS ai_escalations_insert ON ai_escalations;
CREATE POLICY ai_escalations_insert ON ai_escalations
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS ai_escalations_update ON ai_escalations;
CREATE POLICY ai_escalations_update ON ai_escalations
  FOR UPDATE USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

INSERT INTO schema_migrations (version)
VALUES ('0018_ai_review_escalations')
ON CONFLICT (version) DO NOTHING;

-- ========================================
-- db/migrations/0019_ai_model_config_usage.sql
-- ========================================
-- Section 4d: ai_model_configurations (platform-managed, not
-- tenant-editable — ADR-002) and ai_usage_log. field_app gets SELECT only
-- on ai_model_configurations; there is no tenant-facing endpoint that can
-- change the AI provider or model.

CREATE TABLE IF NOT EXISTS ai_model_configurations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  provider        varchar NOT NULL DEFAULT 'bedrock' CHECK (provider = 'bedrock'),
  model_name      varchar NOT NULL CHECK (model_name LIKE 'au.%'),
  region          varchar NOT NULL DEFAULT 'ap-southeast-2' CHECK (region = 'ap-southeast-2'),
  prompt_version  varchar NOT NULL,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  row_version     integer NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_ai_model_configurations_tenant_id ON ai_model_configurations(tenant_id);

-- One active row per tenant.
CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_model_configurations_active_per_tenant
  ON ai_model_configurations(tenant_id) WHERE is_active;

DROP TRIGGER IF EXISTS trg_ai_model_configurations_bump_row_version ON ai_model_configurations;
CREATE TRIGGER trg_ai_model_configurations_bump_row_version
  BEFORE UPDATE ON ai_model_configurations
  FOR EACH ROW EXECUTE FUNCTION bump_row_version();

ALTER TABLE ai_model_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_model_configurations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_model_configurations_select ON ai_model_configurations;
CREATE POLICY ai_model_configurations_select ON ai_model_configurations
  FOR SELECT USING (tenant_id = current_tenant_id());

-- Narrow the blanket grant from ALTER DEFAULT PRIVILEGES (0002) down to
-- read-only for this one table.
REVOKE INSERT, UPDATE, DELETE ON ai_model_configurations FROM field_app;

CREATE TABLE IF NOT EXISTS ai_usage_log (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES tenants(id),
  user_id        uuid NOT NULL REFERENCES users(id),
  message_id     uuid NOT NULL REFERENCES ai_messages(id),
  tokens_used    integer NOT NULL,
  cost_estimate  double precision NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_log_tenant_id ON ai_usage_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_user_id ON ai_usage_log(user_id);

ALTER TABLE ai_usage_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_log FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_usage_log_select ON ai_usage_log;
CREATE POLICY ai_usage_log_select ON ai_usage_log
  FOR SELECT USING (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS ai_usage_log_insert ON ai_usage_log;
CREATE POLICY ai_usage_log_insert ON ai_usage_log
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());

INSERT INTO schema_migrations (version)
VALUES ('0019_ai_model_config_usage')
ON CONFLICT (version) DO NOTHING;

-- ========================================
-- db/migrations/0020_technical_support.sql
-- ========================================
-- Section 5: Technical Support (Phase 1 data model). Zoho Desk is the
-- system of record — zoho_ticket_id is a reference field only, live sync
-- is Phase 2.

CREATE TABLE IF NOT EXISTS support_cases (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id),
  machine_id       uuid REFERENCES machines(id),
  zoho_ticket_id   varchar,
  subject          varchar NOT NULL,
  status           varchar NOT NULL DEFAULT 'open',
  assigned_to      uuid REFERENCES users(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  row_version      integer NOT NULL DEFAULT 1,
  deleted_at       timestamptz
);

CREATE INDEX IF NOT EXISTS idx_support_cases_tenant_id ON support_cases(tenant_id);

DROP TRIGGER IF EXISTS trg_support_cases_bump_row_version ON support_cases;
CREATE TRIGGER trg_support_cases_bump_row_version
  BEFORE UPDATE ON support_cases
  FOR EACH ROW EXECUTE FUNCTION bump_row_version();

ALTER TABLE support_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_cases FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS support_cases_select ON support_cases;
CREATE POLICY support_cases_select ON support_cases
  FOR SELECT USING (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS support_cases_insert ON support_cases;
CREATE POLICY support_cases_insert ON support_cases
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS support_cases_update ON support_cases;
CREATE POLICY support_cases_update ON support_cases
  FOR UPDATE USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE TABLE IF NOT EXISTS support_updates (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id),
  support_case_id   uuid NOT NULL REFERENCES support_cases(id),
  note              text NOT NULL,
  created_by        uuid NOT NULL REFERENCES users(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  row_version       integer NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_support_updates_tenant_id ON support_updates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_support_updates_support_case_id ON support_updates(support_case_id);

ALTER TABLE support_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_updates FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS support_updates_select ON support_updates;
CREATE POLICY support_updates_select ON support_updates
  FOR SELECT USING (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS support_updates_insert ON support_updates;
CREATE POLICY support_updates_insert ON support_updates
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());

CREATE TABLE IF NOT EXISTS support_attachments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id),
  support_case_id   uuid NOT NULL REFERENCES support_cases(id),
  file_url          varchar NOT NULL,
  file_type         varchar NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_attachments_tenant_id ON support_attachments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_support_attachments_support_case_id ON support_attachments(support_case_id);

ALTER TABLE support_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_attachments FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS support_attachments_select ON support_attachments;
CREATE POLICY support_attachments_select ON support_attachments
  FOR SELECT USING (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS support_attachments_insert ON support_attachments;
CREATE POLICY support_attachments_insert ON support_attachments
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());

-- escalated_by is a user reference (uuid), for consistency with
-- ai_escalations.escalated_by elsewhere in this schema.
CREATE TABLE IF NOT EXISTS support_escalations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id),
  support_case_id   uuid NOT NULL REFERENCES support_cases(id),
  escalated_by      uuid NOT NULL REFERENCES users(id),
  reason            text,
  status            varchar NOT NULL DEFAULT 'pending',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  row_version       integer NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_support_escalations_tenant_id ON support_escalations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_support_escalations_support_case_id ON support_escalations(support_case_id);

DROP TRIGGER IF EXISTS trg_support_escalations_bump_row_version ON support_escalations;
CREATE TRIGGER trg_support_escalations_bump_row_version
  BEFORE UPDATE ON support_escalations
  FOR EACH ROW EXECUTE FUNCTION bump_row_version();

ALTER TABLE support_escalations ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_escalations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS support_escalations_select ON support_escalations;
CREATE POLICY support_escalations_select ON support_escalations
  FOR SELECT USING (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS support_escalations_insert ON support_escalations;
CREATE POLICY support_escalations_insert ON support_escalations
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS support_escalations_update ON support_escalations;
CREATE POLICY support_escalations_update ON support_escalations
  FOR UPDATE USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

INSERT INTO schema_migrations (version)
VALUES ('0020_technical_support')
ON CONFLICT (version) DO NOTHING;

-- ========================================
-- db/migrations/0021_technical_toolbox.sql
-- ========================================
-- Section 6: Technical Toolbox. toolbox_items is a shared platform
-- library (like machine_manufacturers/models) — the calculators
-- themselves aren't tenant data, so no tenant_id/RLS there. Results and
-- favourites belong to a tenant's users.

CREATE TABLE IF NOT EXISTS toolbox_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         varchar NOT NULL,
  category     varchar,
  description  text,
  config       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  row_version  integer NOT NULL DEFAULT 1,
  deleted_at   timestamptz
);

DROP TRIGGER IF EXISTS trg_toolbox_items_bump_row_version ON toolbox_items;
CREATE TRIGGER trg_toolbox_items_bump_row_version
  BEFORE UPDATE ON toolbox_items
  FOR EACH ROW EXECUTE FUNCTION bump_row_version();

CREATE TABLE IF NOT EXISTS calculator_results (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id),
  toolbox_item_id  uuid NOT NULL REFERENCES toolbox_items(id),
  user_id          uuid NOT NULL REFERENCES users(id),
  input_data       jsonb NOT NULL,
  result_data      jsonb NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_calculator_results_tenant_id ON calculator_results(tenant_id);
CREATE INDEX IF NOT EXISTS idx_calculator_results_user_id ON calculator_results(user_id);

ALTER TABLE calculator_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE calculator_results FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS calculator_results_select ON calculator_results;
CREATE POLICY calculator_results_select ON calculator_results
  FOR SELECT USING (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS calculator_results_insert ON calculator_results;
CREATE POLICY calculator_results_insert ON calculator_results
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());

CREATE TABLE IF NOT EXISTS user_favourite_tools (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id),
  user_id          uuid NOT NULL REFERENCES users(id),
  toolbox_item_id  uuid NOT NULL REFERENCES toolbox_items(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, toolbox_item_id)
);

CREATE INDEX IF NOT EXISTS idx_user_favourite_tools_tenant_id ON user_favourite_tools(tenant_id);

ALTER TABLE user_favourite_tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_favourite_tools FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_favourite_tools_select ON user_favourite_tools;
CREATE POLICY user_favourite_tools_select ON user_favourite_tools
  FOR SELECT USING (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS user_favourite_tools_insert ON user_favourite_tools;
CREATE POLICY user_favourite_tools_insert ON user_favourite_tools
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS user_favourite_tools_delete ON user_favourite_tools;
CREATE POLICY user_favourite_tools_delete ON user_favourite_tools
  FOR DELETE USING (tenant_id = current_tenant_id());

-- A favourite is a toggle, not a business record — unlike everything else
-- in this schema it's fine to hard-delete, so field_app needs the grant.
GRANT DELETE ON user_favourite_tools TO field_app;

INSERT INTO schema_migrations (version)
VALUES ('0021_technical_toolbox')
ON CONFLICT (version) DO NOTHING;

-- ========================================
-- db/migrations/0022_audit.sql
-- ========================================
-- Section 7: audit_logs. Append-only by design — no updated_at/row_version
-- since a log entry is never edited, and no UPDATE/DELETE policy at all.

CREATE TABLE IF NOT EXISTS audit_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id),
  user_id      uuid REFERENCES users(id),
  action       varchar NOT NULL CHECK (action IN ('create', 'update', 'delete', 'login')),
  entity_type  varchar NOT NULL,
  entity_id    uuid,
  metadata     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_logs_select ON audit_logs;
CREATE POLICY audit_logs_select ON audit_logs
  FOR SELECT USING (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS audit_logs_insert ON audit_logs;
CREATE POLICY audit_logs_insert ON audit_logs
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());

INSERT INTO schema_migrations (version)
VALUES ('0022_audit')
ON CONFLICT (version) DO NOTHING;

-- ========================================
-- db/migrations/0023_users_cognito_identity.sql
-- ========================================
-- Section 1d: links a users row to its AWS Cognito identity (Google /
-- Apple federated sign-in via the Cognito hosted UI). Email/password login
-- keeps using password_hash and our own sessions; cognito_sub is set once a
-- user has signed in, or signed up, through Cognito.

ALTER TABLE users ADD COLUMN IF NOT EXISTS cognito_sub varchar;
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider varchar NOT NULL DEFAULT 'password';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_auth_provider_check'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_auth_provider_check
      CHECK (auth_provider IN ('password', 'google', 'apple'));
  END IF;
END $$;

-- Users who sign up through Google/Apple never set a FIELD password, but
-- every user must still have at least one way to sign in.
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_sign_in_method_check'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_sign_in_method_check
      CHECK (password_hash IS NOT NULL OR cognito_sub IS NOT NULL);
  END IF;
END $$;

-- Unique index doubles as the lookup index for sign-in by Cognito sub.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_cognito_sub ON users(cognito_sub);

-- Same reasoning as auth_lookup_user_by_email (0003): a Cognito sign-in
-- arrives with no tenant context, so the lookup must bypass RLS. Owned by
-- the migration role, callable only by field_app, returns only what auth
-- needs.
CREATE OR REPLACE FUNCTION auth_lookup_user_by_cognito_sub(p_cognito_sub varchar)
RETURNS TABLE (
  id             uuid,
  tenant_id      uuid,
  email          varchar,
  status         varchar,
  first_name     varchar,
  last_name      varchar,
  tenant_status  varchar
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT u.id, u.tenant_id, u.email, u.status,
         u.first_name, u.last_name, t.status AS tenant_status
  FROM users u
  JOIN tenants t ON t.id = u.tenant_id
  WHERE u.cognito_sub = p_cognito_sub
    AND u.deleted_at IS NULL;
$$;

REVOKE ALL ON FUNCTION auth_lookup_user_by_cognito_sub(varchar) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_lookup_user_by_cognito_sub(varchar) TO field_app;

INSERT INTO schema_migrations (version)
VALUES ('0023_users_cognito_identity')
ON CONFLICT (version) DO NOTHING;

-- ========================================
-- db/migrations/0024_users_phone_number.sql
-- ========================================
-- Section 1e: contact phone number on users. Collected (required) when a
-- first-time Google/Apple user completes their signup profile; nullable
-- because existing users were created without one.

ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number varchar;

INSERT INTO schema_migrations (version)
VALUES ('0024_users_phone_number')
ON CONFLICT (version) DO NOTHING;

-- ========================================
-- db/migrations/0025_delete_user_account.sql
-- ========================================
-- Section 1f: self-service account deletion. field_app has no DELETE grant
-- (soft delete only, see 0002), so the hard delete lives in one SECURITY
-- DEFINER function that runs the whole cascade atomically.
--
-- What happens to each users(id) reference:
--   * Personal data is deleted: sessions, device registrations, role
--     assignments, AI conversations (and everything hanging off their
--     messages), knowledge feedback, calculator results, favourite tools.
--   * Shared tenant records stay on the tenant's CMDB — machines, history,
--     snapshots, knowledge, support, audit — with the user reference set to
--     NULL, which reads as "deleted user".

-- Authorship columns on shared records must be able to outlive their author.
ALTER TABLE machines ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE component_replacement_records ALTER COLUMN replaced_by DROP NOT NULL;
ALTER TABLE technical_history_entries ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE knowledge_items ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE document_versions ALTER COLUMN uploaded_by DROP NOT NULL;
ALTER TABLE resolution_records ALTER COLUMN authored_by DROP NOT NULL;
ALTER TABLE review_queue_items ALTER COLUMN submitted_by DROP NOT NULL;
ALTER TABLE support_updates ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE support_escalations ALTER COLUMN escalated_by DROP NOT NULL;
ALTER TABLE ai_escalations ALTER COLUMN escalated_by DROP NOT NULL;

-- An approval keeps its timestamp after the approver is deleted, so only
-- "approver without a time" is still invalid.
ALTER TABLE resolution_records
  DROP CONSTRAINT IF EXISTS resolution_records_approval_set_together;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'resolution_records_approver_has_time'
  ) THEN
    ALTER TABLE resolution_records ADD CONSTRAINT resolution_records_approver_has_time
      CHECK (approved_by IS NULL OR approved_at IS NOT NULL);
  END IF;
END $$;

-- Returns false when no such user exists in that tenant. Owned by the
-- migration role so it bypasses RLS; only field_app may call it, and the
-- backend only ever passes the caller's own id + tenant from their JWT.
CREATE OR REPLACE FUNCTION delete_user_account(p_user_id uuid, p_tenant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conversation_ids uuid[];
  v_message_ids uuid[];
BEGIN
  PERFORM 1 FROM users WHERE id = p_user_id AND tenant_id = p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- AI conversations, leaf tables first.
  SELECT coalesce(array_agg(id), '{}') INTO v_conversation_ids
    FROM ai_conversations WHERE user_id = p_user_id;
  SELECT coalesce(array_agg(id), '{}') INTO v_message_ids
    FROM ai_messages WHERE conversation_id = ANY (v_conversation_ids);

  DELETE FROM ai_source_references WHERE message_id = ANY (v_message_ids);
  DELETE FROM ai_feedback WHERE message_id = ANY (v_message_ids);
  DELETE FROM ai_review_items WHERE message_id = ANY (v_message_ids);
  DELETE FROM ai_usage_log
    WHERE user_id = p_user_id OR message_id = ANY (v_message_ids);
  DELETE FROM ai_escalations
    WHERE conversation_id = ANY (v_conversation_ids);
  -- A resolution record distilled from the chat is published knowledge; it
  -- stays, just without its source conversation.
  UPDATE resolution_records SET conversation_id = NULL
    WHERE conversation_id = ANY (v_conversation_ids);
  DELETE FROM ai_messages WHERE id = ANY (v_message_ids);
  DELETE FROM ai_conversations WHERE id = ANY (v_conversation_ids);

  -- Remaining personal data.
  DELETE FROM sessions WHERE user_id = p_user_id;
  DELETE FROM device_registrations WHERE user_id = p_user_id;
  DELETE FROM user_roles WHERE user_id = p_user_id;
  DELETE FROM knowledge_feedback WHERE user_id = p_user_id;
  DELETE FROM calculator_results WHERE user_id = p_user_id;
  DELETE FROM user_favourite_tools WHERE user_id = p_user_id;

  -- Shared tenant records: detach the user.
  UPDATE machines SET created_by = NULL WHERE created_by = p_user_id;
  UPDATE component_replacement_records SET replaced_by = NULL WHERE replaced_by = p_user_id;
  UPDATE technical_history_entries SET created_by = NULL WHERE created_by = p_user_id;
  UPDATE configuration_snapshots SET taken_by = NULL WHERE taken_by = p_user_id;
  UPDATE knowledge_items SET created_by = NULL WHERE created_by = p_user_id;
  UPDATE document_versions SET uploaded_by = NULL WHERE uploaded_by = p_user_id;
  UPDATE resolution_records SET authored_by = NULL WHERE authored_by = p_user_id;
  UPDATE resolution_records SET approved_by = NULL WHERE approved_by = p_user_id;
  UPDATE review_queue_items SET submitted_by = NULL WHERE submitted_by = p_user_id;
  UPDATE review_queue_items SET reviewed_by = NULL WHERE reviewed_by = p_user_id;
  UPDATE ai_escalations SET escalated_by = NULL WHERE escalated_by = p_user_id;
  UPDATE ai_escalations SET escalated_to = NULL WHERE escalated_to = p_user_id;
  UPDATE support_cases SET assigned_to = NULL WHERE assigned_to = p_user_id;
  UPDATE support_updates SET created_by = NULL WHERE created_by = p_user_id;
  UPDATE support_escalations SET escalated_by = NULL WHERE escalated_by = p_user_id;
  -- audit_logs is append-only for the app; this is the one sanctioned
  -- rewrite, so the trail survives without pointing at a deleted user.
  UPDATE audit_logs SET user_id = NULL WHERE user_id = p_user_id;

  DELETE FROM users WHERE id = p_user_id;

  INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id)
  VALUES (p_tenant_id, NULL, 'delete', 'user', p_user_id);

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION delete_user_account(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delete_user_account(uuid, uuid) TO field_app;

INSERT INTO schema_migrations (version)
VALUES ('0025_delete_user_account')
ON CONFLICT (version) DO NOTHING;

-- ========================================
-- db/migrations/0026_users_avatar_url.sql
-- ========================================
-- Section 1g: profile photo on users. Filled from the Google `picture`
-- claim on every Google sign-in (Google photo URLs can change), never
-- cleared by a sign-in that carries no photo (Apple, email/password).

ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url varchar;

-- Both sign-in lookups also return avatar_url so every session — email/
-- password included — can carry the photo. A function's result columns
-- can't be changed in place, hence DROP + CREATE. Otherwise identical to
-- 0003 / 0023.
DROP FUNCTION IF EXISTS auth_lookup_user_by_email(varchar);
CREATE FUNCTION auth_lookup_user_by_email(p_email varchar)
RETURNS TABLE (
  id             uuid,
  tenant_id      uuid,
  password_hash  varchar,
  status         varchar,
  first_name     varchar,
  last_name      varchar,
  avatar_url     varchar,
  tenant_status  varchar
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT u.id, u.tenant_id, u.password_hash, u.status,
         u.first_name, u.last_name, u.avatar_url, t.status AS tenant_status
  FROM users u
  JOIN tenants t ON t.id = u.tenant_id
  WHERE u.email = p_email
    AND u.deleted_at IS NULL;
$$;

REVOKE ALL ON FUNCTION auth_lookup_user_by_email(varchar) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_lookup_user_by_email(varchar) TO field_app;

DROP FUNCTION IF EXISTS auth_lookup_user_by_cognito_sub(varchar);
CREATE FUNCTION auth_lookup_user_by_cognito_sub(p_cognito_sub varchar)
RETURNS TABLE (
  id             uuid,
  tenant_id      uuid,
  email          varchar,
  status         varchar,
  first_name     varchar,
  last_name      varchar,
  avatar_url     varchar,
  tenant_status  varchar
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT u.id, u.tenant_id, u.email, u.status,
         u.first_name, u.last_name, u.avatar_url, t.status AS tenant_status
  FROM users u
  JOIN tenants t ON t.id = u.tenant_id
  WHERE u.cognito_sub = p_cognito_sub
    AND u.deleted_at IS NULL;
$$;

REVOKE ALL ON FUNCTION auth_lookup_user_by_cognito_sub(varchar) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_lookup_user_by_cognito_sub(varchar) TO field_app;

INSERT INTO schema_migrations (version)
VALUES ('0026_users_avatar_url')
ON CONFLICT (version) DO NOTHING;

-- ========================================
-- db/migrations/0027_customer_role.sql
-- ========================================
-- Section 1b follow-up: a "Customer" system role, now the role every
-- self-serve signup (email/password, Google, Apple) receives instead of
-- Owner. Existing users keep the roles they already have.

-- roles has no unique constraint on name, so ON CONFLICT can't dedupe;
-- NOT EXISTS keeps this migration safe to re-run.
INSERT INTO roles (name, is_system_role, tenant_id)
SELECT 'Customer', true, NULL
WHERE NOT EXISTS (
  SELECT 1 FROM roles
  WHERE name = 'Customer' AND is_system_role = true AND tenant_id IS NULL
);

-- Starter permission set: the AI assistant only. Grant more here as the
-- customer-facing features land.
INSERT INTO role_permissions (role_id, permission_id, tenant_id)
SELECT r.id, p.id, NULL
FROM roles r
JOIN permissions p ON p.code IN ('ai.use')
WHERE r.name = 'Customer' AND r.is_system_role = true AND r.tenant_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO schema_migrations (version)
VALUES ('0027_customer_role')
ON CONFLICT (version) DO NOTHING;

