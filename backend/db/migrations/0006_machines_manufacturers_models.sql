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
