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
