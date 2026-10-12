-- Section 1o: cleanup for databases that ran an earlier draft of 0055,
-- which added a separate "Super Admin" role. Owner is the platform
-- administrator instead (0055_platform_permission). On a database that
-- never had that role, every statement here is a no-op.

-- Whoever held Super Admin becomes an Owner (in their own organisation).
INSERT INTO user_roles (user_id, role_id, tenant_id)
SELECT ur.user_id, owner.id, ur.tenant_id
FROM user_roles ur
JOIN roles sa ON sa.id = ur.role_id AND sa.name = 'Super Admin' AND sa.tenant_id IS NULL
CROSS JOIN (
  SELECT id FROM roles
  WHERE name = 'Owner' AND is_system_role AND tenant_id IS NULL AND deleted_at IS NULL
) owner
ON CONFLICT DO NOTHING;

DROP TRIGGER IF EXISTS trg_roles_guard_super_admin ON roles;
DROP FUNCTION IF EXISTS guard_super_admin_role();
DROP FUNCTION IF EXISTS sync_super_admin_role(uuid, boolean);

DELETE FROM user_roles
WHERE role_id IN (SELECT id FROM roles WHERE name = 'Super Admin' AND tenant_id IS NULL);
DELETE FROM role_permissions
WHERE role_id IN (SELECT id FROM roles WHERE name = 'Super Admin' AND tenant_id IS NULL);
UPDATE roles SET deleted_at = now()
WHERE name = 'Super Admin' AND tenant_id IS NULL AND deleted_at IS NULL;

INSERT INTO schema_migrations (version)
VALUES ('0060_retire_super_admin')
ON CONFLICT (version) DO NOTHING;
