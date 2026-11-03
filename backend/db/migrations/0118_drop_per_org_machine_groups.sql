-- Section 2g (continued): the per-organisation group structure goes, its
-- data having moved to machine_group_machines and machine_group_assignments
-- (0115).
--   * machines.group_id and its transfer trigger: membership now lives in
--     machine_group_machines. A machine moved to another organisation
--     (complete_machine_transfer, 0100) leaves every group, so nobody keeps
--     seeing it, or its new owner's history, through an old share.
--   * user_machine_group_access: replaced by 'user' assignments.
--   * machine_groups loses tenant_id and the contact fields (description
--     replaces notes); a live name is unique across the platform.

DROP TRIGGER IF EXISTS trg_machines_clear_group_on_transfer ON machines;
DROP FUNCTION IF EXISTS clear_machine_group_on_transfer();
ALTER TABLE machines DROP CONSTRAINT IF EXISTS machines_group_fk;
DROP INDEX IF EXISTS idx_machines_group_id;
ALTER TABLE machines DROP COLUMN IF EXISTS group_id;

CREATE OR REPLACE FUNCTION remove_transferred_machine_from_groups()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
    DELETE FROM machine_group_machines WHERE machine_id = NEW.id;
    DELETE FROM machine_share_exclusions WHERE machine_id = NEW.id;
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_machines_leave_groups_on_transfer ON machines;
CREATE TRIGGER trg_machines_leave_groups_on_transfer
  AFTER UPDATE OF tenant_id ON machines
  FOR EACH ROW EXECUTE FUNCTION remove_transferred_machine_from_groups();

DROP TABLE IF EXISTS user_machine_group_access;

DROP INDEX IF EXISTS uq_machine_groups_live_name;
ALTER TABLE machine_groups DROP CONSTRAINT IF EXISTS machine_groups_tenant_id_id_key;
ALTER TABLE machine_groups
  DROP COLUMN IF EXISTS tenant_id,
  DROP COLUMN IF EXISTS contact_name,
  DROP COLUMN IF EXISTS contact_email,
  DROP COLUMN IF EXISTS contact_phone,
  DROP COLUMN IF EXISTS notes;
CREATE UNIQUE INDEX IF NOT EXISTS uq_machine_groups_live_name
  ON machine_groups (lower(name)) WHERE deleted_at IS NULL;

INSERT INTO schema_migrations (version)
VALUES ('0118_drop_per_org_machine_groups')
ON CONFLICT (version) DO NOTHING;
