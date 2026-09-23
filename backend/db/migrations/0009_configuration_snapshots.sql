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
