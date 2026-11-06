-- Section 2f: machine groups — an organisation groups its machines by
-- customer (e.g. "ABC Earthmoving", 30 machines). A machine is in at most
-- one group; existing machines stay ungrouped.
--   * machine_groups: soft delete; a live name is unique per organisation,
--     ignoring case. Deleting a group ungroups its machines (the backend
--     does that in the same transaction).
--   * machines.group_id: the foreign key includes tenant_id, so a machine
--     can never point at another organisation's group.
--   * A machine moved to another organisation (complete_machine_transfer,
--     0100) leaves its group behind: a trigger clears group_id whenever
--     tenant_id changes, before the foreign key is checked.

CREATE TABLE IF NOT EXISTS machine_groups (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES tenants(id),
  name           varchar NOT NULL CHECK (length(btrim(name)) > 0),
  colour         varchar CHECK (colour ~ '^#[0-9A-Fa-f]{6}$'),
  contact_name   varchar,
  contact_email  varchar,
  contact_phone  varchar,
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  row_version    integer NOT NULL DEFAULT 1,
  deleted_at     timestamptz,
  UNIQUE (tenant_id, id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_machine_groups_live_name
  ON machine_groups (tenant_id, lower(name)) WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_machine_groups_bump_row_version ON machine_groups;
CREATE TRIGGER trg_machine_groups_bump_row_version
  BEFORE UPDATE ON machine_groups
  FOR EACH ROW EXECUTE FUNCTION bump_row_version();

ALTER TABLE machine_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE machine_groups FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS machine_groups_select ON machine_groups;
CREATE POLICY machine_groups_select ON machine_groups
  FOR SELECT USING (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS machine_groups_insert ON machine_groups;
CREATE POLICY machine_groups_insert ON machine_groups
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS machine_groups_update ON machine_groups;
CREATE POLICY machine_groups_update ON machine_groups
  FOR UPDATE USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

ALTER TABLE machines ADD COLUMN IF NOT EXISTS group_id uuid;

ALTER TABLE machines DROP CONSTRAINT IF EXISTS machines_group_fk;
ALTER TABLE machines ADD CONSTRAINT machines_group_fk
  FOREIGN KEY (tenant_id, group_id) REFERENCES machine_groups (tenant_id, id);

CREATE INDEX IF NOT EXISTS idx_machines_group_id
  ON machines (group_id) WHERE group_id IS NOT NULL;

CREATE OR REPLACE FUNCTION clear_machine_group_on_transfer()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
    NEW.group_id := NULL;
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_machines_clear_group_on_transfer ON machines;
CREATE TRIGGER trg_machines_clear_group_on_transfer
  BEFORE UPDATE OF tenant_id ON machines
  FOR EACH ROW EXECUTE FUNCTION clear_machine_group_on_transfer();

INSERT INTO schema_migrations (version)
VALUES ('0113_machine_groups')
ON CONFLICT (version) DO NOTHING;
