-- Deleting a machine is a soft delete (machineDeletion.service.ts): its records
-- and billing history stay, and it disappears from every read.

-- The serial number is free to register again once the machine is deleted.
ALTER TABLE machines DROP CONSTRAINT IF EXISTS machines_tenant_id_serial_number_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_machines_tenant_serial_live
  ON machines (tenant_id, serial_number) WHERE deleted_at IS NULL;

-- What every app read joins: a deleted machine is nobody's, including its owner's.
CREATE OR REPLACE FUNCTION accessible_machines()
RETURNS TABLE (machine_id uuid, tenant_id uuid, access_level varchar, is_shared boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH me AS (
    SELECT u.id, u.tenant_id,
           u.machine_access_mode = 'all' OR EXISTS (
             SELECT 1 FROM user_roles ur
             JOIN roles r ON r.id = ur.role_id AND r.deleted_at IS NULL
             JOIN role_permissions rp ON rp.role_id = r.id
             JOIN permissions p ON p.id = rp.permission_id
             WHERE ur.user_id = u.id
               AND p.code IN ('admin.manage_users', 'platform.manage')) AS sees_own
    FROM users u
    WHERE u.id = current_app_user_id() AND u.tenant_id = current_tenant_id()
      AND u.deleted_at IS NULL
  ),
  shared AS (SELECT * FROM shared_machine_access())
  SELECT m.id, m.tenant_id, 'owner'::varchar, false
  FROM machines m
  WHERE m.tenant_id = current_tenant_id() AND m.deleted_at IS NULL
    AND (current_app_user_id() IS NULL
         OR EXISTS (SELECT 1 FROM me WHERE me.sees_own)
         OR m.id IN (SELECT s.machine_id FROM shared s))
  UNION ALL
  SELECT s.machine_id, s.tenant_id, s.access_level, true
  FROM shared s
  WHERE s.tenant_id IS DISTINCT FROM current_tenant_id();
$$;

INSERT INTO schema_migrations (version)
VALUES ('0124_machine_soft_delete')
ON CONFLICT (version) DO NOTHING;
