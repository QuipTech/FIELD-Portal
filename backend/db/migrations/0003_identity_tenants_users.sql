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
