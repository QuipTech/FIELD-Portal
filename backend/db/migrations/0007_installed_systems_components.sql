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
