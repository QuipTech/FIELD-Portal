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
