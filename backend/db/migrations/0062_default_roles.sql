-- Section 1q: default roles. The roles the platform ships with (seeded by
-- 0004 and 0027) can't be deleted or renamed; roles an Owner adds from
-- the Roles & permissions page can be. Marked in the data rather than by
-- name, so the rule holds wherever roles are changed.

ALTER TABLE roles ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;

UPDATE roles SET is_default = true
WHERE tenant_id IS NULL AND is_system_role AND deleted_at IS NULL
  AND name IN ('Owner', 'Customer', 'Technical Manager', 'Field Technician', 'Knowledge Manager');

-- A default role can't be renamed, deleted or demoted from default.
CREATE OR REPLACE FUNCTION guard_default_role()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.is_default AND (
       NEW.name IS DISTINCT FROM OLD.name
       OR NEW.deleted_at IS NOT NULL
       OR NOT NEW.is_default
     ) THEN
    RAISE EXCEPTION 'The % role is a default role and can''t be renamed or deleted', OLD.name
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_roles_guard_default ON roles;
CREATE TRIGGER trg_roles_guard_default
  BEFORE UPDATE ON roles
  FOR EACH ROW EXECUTE FUNCTION guard_default_role();

-- Also reports 'default_role' (can't be deleted) besides 0057's outcomes.
CREATE OR REPLACE FUNCTION admin_delete_role(p_tenant_id uuid, p_role_id uuid)
RETURNS varchar
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_is_default boolean;
BEGIN
  SELECT is_default INTO v_is_default FROM roles
  WHERE id = p_role_id AND deleted_at IS NULL
    AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id)
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN 'not_found';
  END IF;
  IF v_is_default THEN
    RETURN 'default_role';
  END IF;

  IF EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN users u ON u.id = ur.user_id AND u.deleted_at IS NULL
    WHERE ur.role_id = p_role_id
  ) THEN
    RETURN 'in_use';
  END IF;

  DELETE FROM role_permissions WHERE role_id = p_role_id;
  UPDATE roles SET deleted_at = now() WHERE id = p_role_id;
  RETURN 'deleted';
END;
$$;

-- admin_list_roles (0057) plus is_default; the return type changes, so
-- it's dropped and recreated.
DROP FUNCTION IF EXISTS admin_list_roles(uuid, uuid);
CREATE OR REPLACE FUNCTION admin_list_roles(p_tenant_id uuid, p_role_id uuid DEFAULT NULL)
RETURNS TABLE (
  id uuid, name varchar, tenant_id uuid, organisation_name varchar,
  is_default boolean, user_count bigint, permission_codes varchar[]
)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT r.id, r.name, r.tenant_id, t.name, r.is_default,
         (SELECT count(*) FROM user_roles ur
            JOIN users u ON u.id = ur.user_id AND u.deleted_at IS NULL
           WHERE ur.role_id = r.id
             AND (p_tenant_id IS NULL OR u.tenant_id = p_tenant_id)),
         COALESCE(
           (SELECT array_agg(p.code ORDER BY p.code)
              FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id
             WHERE rp.role_id = r.id),
           '{}'::varchar[])
  FROM roles r
  LEFT JOIN tenants t ON t.id = r.tenant_id
  WHERE r.deleted_at IS NULL
    AND ((r.tenant_id IS NULL AND r.is_system_role)
         OR p_tenant_id IS NULL OR r.tenant_id = p_tenant_id)
    AND (p_role_id IS NULL OR r.id = p_role_id)
  ORDER BY r.is_default DESC, r.tenant_id IS NOT NULL, t.name, r.name;
$$;

REVOKE ALL ON FUNCTION admin_list_roles(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_list_roles(uuid, uuid) TO field_app;

INSERT INTO schema_migrations (version)
VALUES ('0062_default_roles')
ON CONFLICT (version) DO NOTHING;
