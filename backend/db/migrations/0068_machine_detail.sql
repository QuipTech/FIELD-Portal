-- Section 2f: what the portal's machine detail screens read. Each machine
-- gets its own installed system/component tree, copied from its model's
-- template in the Machine library (0040) when it's registered, plus a
-- baseline configuration snapshot so "Configuration history" has a
-- starting point. History entries can name the component they affected
-- and record the hour meter and downtime; machines get a gallery of
-- photos; snapshots can be marked "known good".

ALTER TABLE installed_components
  ADD COLUMN IF NOT EXISTS model_component_id uuid REFERENCES model_components(id),
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
ALTER TABLE installed_systems
  ADD COLUMN IF NOT EXISTS model_system_id uuid REFERENCES model_systems(id),
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

ALTER TABLE technical_history_entries
  ADD COLUMN IF NOT EXISTS installed_component_id uuid REFERENCES installed_components(id),
  ADD COLUMN IF NOT EXISTS operating_hours integer CHECK (operating_hours IS NULL OR operating_hours >= 0),
  ADD COLUMN IF NOT EXISTS downtime_hours numeric(8, 2) CHECK (downtime_hours IS NULL OR downtime_hours >= 0);
CREATE INDEX IF NOT EXISTS idx_technical_history_entries_component
  ON technical_history_entries (installed_component_id, created_at DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_technical_history_entries_machine_created
  ON technical_history_entries (tenant_id, machine_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- When the hour meter was last read (registration, status or a history entry).
ALTER TABLE machines ADD COLUMN IF NOT EXISTS operating_hours_read_at timestamptz;

ALTER TABLE configuration_snapshots
  ADD COLUMN IF NOT EXISTS is_known_good boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_configuration_snapshots_machine_taken
  ON configuration_snapshots (tenant_id, machine_id, taken_at DESC);
DROP POLICY IF EXISTS configuration_snapshots_update ON configuration_snapshots;
CREATE POLICY configuration_snapshots_update ON configuration_snapshots
  FOR UPDATE USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE TABLE IF NOT EXISTS machine_photos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  machine_id    uuid NOT NULL REFERENCES machines(id),
  storage_key   varchar NOT NULL,
  file_name     varchar,
  content_type  varchar,
  size_bytes    bigint,
  caption       varchar,
  uploaded_by   uuid REFERENCES users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  row_version   integer NOT NULL DEFAULT 1,
  deleted_at    timestamptz
);
CREATE INDEX IF NOT EXISTS idx_machine_photos_machine
  ON machine_photos (tenant_id, machine_id, created_at) WHERE deleted_at IS NULL;
DROP TRIGGER IF EXISTS trg_machine_photos_bump_row_version ON machine_photos;
CREATE TRIGGER trg_machine_photos_bump_row_version
  BEFORE UPDATE ON machine_photos
  FOR EACH ROW EXECUTE FUNCTION bump_row_version();
ALTER TABLE machine_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE machine_photos FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS machine_photos_select ON machine_photos;
CREATE POLICY machine_photos_select ON machine_photos
  FOR SELECT USING (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS machine_photos_insert ON machine_photos;
CREATE POLICY machine_photos_insert ON machine_photos
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS machine_photos_update ON machine_photos;
CREATE POLICY machine_photos_update ON machine_photos
  FOR UPDATE USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Copies the model's systems/components onto a machine that has none
-- yet and takes its baseline snapshot. Uses the machine's own tenant_id
-- (not current_tenant_id()) so the backfill below can run it too.
CREATE OR REPLACE FUNCTION seed_installed_configuration(p_machine_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_machine machines%ROWTYPE;
  v_snapshot_id uuid;
BEGIN
  SELECT * INTO v_machine FROM machines WHERE id = p_machine_id;
  IF NOT FOUND OR EXISTS (SELECT 1 FROM installed_systems WHERE machine_id = p_machine_id) THEN
    RETURN;
  END IF;

  INSERT INTO installed_systems (tenant_id, machine_id, name, model_system_id, sort_order)
  SELECT v_machine.tenant_id, p_machine_id, ms.name, ms.id, ms.sort_order
  FROM model_systems ms
  WHERE ms.machine_model_id = v_machine.model_id AND ms.deleted_at IS NULL;

  INSERT INTO installed_components (tenant_id, installed_system_id, name, model_component_id, sort_order)
  SELECT v_machine.tenant_id, s.id, mc.name, mc.id, mc.sort_order
  FROM installed_systems s
  JOIN model_components mc ON mc.model_system_id = s.model_system_id AND mc.deleted_at IS NULL
  WHERE s.machine_id = p_machine_id;

  IF NOT EXISTS (SELECT 1 FROM installed_systems WHERE machine_id = p_machine_id) THEN
    RETURN;
  END IF;

  INSERT INTO configuration_snapshots (tenant_id, machine_id, taken_by, trigger, is_known_good)
  VALUES (v_machine.tenant_id, p_machine_id, NULL, 'baseline', false)
  RETURNING id INTO v_snapshot_id;

  INSERT INTO configuration_snapshot_items (
    tenant_id, snapshot_id, system_name, component_name,
    serial_number, firmware_version, software_version
  )
  SELECT v_machine.tenant_id, v_snapshot_id, s.name, c.name,
         c.serial_number, c.firmware_version, c.software_version
  FROM installed_systems s
  JOIN installed_components c ON c.installed_system_id = s.id
  WHERE s.machine_id = p_machine_id AND s.deleted_at IS NULL AND c.deleted_at IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION trg_seed_installed_configuration()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM seed_installed_configuration(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_machines_seed_configuration ON machines;
CREATE TRIGGER trg_machines_seed_configuration
  AFTER INSERT ON machines
  FOR EACH ROW EXECUTE FUNCTION trg_seed_installed_configuration();

-- Machines registered before this migration.
SELECT seed_installed_configuration(id) FROM machines WHERE deleted_at IS NULL;

GRANT SELECT, INSERT, UPDATE ON machine_photos, installed_systems, installed_components,
  configuration_snapshots, configuration_snapshot_items TO field_app;
GRANT EXECUTE ON FUNCTION seed_installed_configuration(uuid), capture_configuration_snapshot(uuid, uuid, varchar)
  TO field_app;

INSERT INTO schema_migrations (version)
VALUES ('0068_machine_detail')
ON CONFLICT (version) DO NOTHING;
