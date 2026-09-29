-- Section 1i: role management for the admin portal's Roles & permissions
-- page — the platform-wide system roles (tenant_id IS NULL) that every
-- organisation shares. role_permissions/user_roles are RLS-scoped per
-- tenant and field_app has no DELETE grant, so, like admin_list_users
-- (0028), each operation is a SECURITY DEFINER function callable only by
-- field_app. The backend's RequireRolesGuard (Owner only) is what
-- restricts them; never call them from an unguarded route.

-- Permissions the portal design exposes that 0004 didn't seed. The
-- description doubles as the label shown in the admin portal.
INSERT INTO permissions (code, description) VALUES
  ('machine.view', 'View machines'),
  ('history.create', 'Add history entries'),
  ('history.edit_others', 'Edit others'' entries'),
  ('support.create', 'Raise support cases'),
  ('machine_library.manage', 'Manage machine library'),
  ('audit.view', 'View audit log')
ON CONFLICT (code) DO NOTHING;

-- Owner holds every permission, including the ones added above.
INSERT INTO role_permissions (role_id, permission_id, tenant_id)
SELECT r.id, p.id, NULL
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Owner' AND r.is_system_role AND r.tenant_id IS NULL
ON CONFLICT DO NOTHING;

-- One live system role per name (case-insensitive); a soft-deleted
-- role's name can be reused.
CREATE UNIQUE INDEX IF NOT EXISTS uq_roles_system_name
  ON roles (lower(name))
  WHERE tenant_id IS NULL AND deleted_at IS NULL;

-- p_role_id NULL lists every live system role; otherwise just that one.
CREATE OR REPLACE FUNCTION admin_list_roles(p_role_id uuid DEFAULT NULL)
RETURNS TABLE (
  id                uuid,
  name              varchar,
  user_count        bigint,
  permission_codes  varchar[]
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT r.id, r.name,
         (SELECT count(*)
            FROM user_roles ur
            JOIN users u ON u.id = ur.user_id AND u.deleted_at IS NULL
           WHERE ur.role_id = r.id),
         COALESCE(
           (SELECT array_agg(p.code ORDER BY p.code)
              FROM role_permissions rp
              JOIN permissions p ON p.id = rp.permission_id
             WHERE rp.role_id = r.id),
           '{}'::varchar[])
  FROM roles r
  WHERE r.tenant_id IS NULL
    AND r.is_system_role
    AND r.deleted_at IS NULL
    AND (p_role_id IS NULL OR r.id = p_role_id)
  ORDER BY r.name;
$$;

-- Unknown permission codes are ignored; the backend validates them first.
CREATE OR REPLACE FUNCTION admin_create_role(
  p_name              varchar,
  p_permission_codes  varchar[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role_id uuid;
BEGIN
  INSERT INTO roles (name, is_system_role, tenant_id)
  VALUES (p_name, true, NULL)
  RETURNING id INTO v_role_id;

  INSERT INTO role_permissions (role_id, permission_id, tenant_id)
  SELECT v_role_id, p.id, NULL
  FROM permissions p
  WHERE p.code = ANY (p_permission_codes);

  RETURN v_role_id;
END;
$$;

-- NULL p_name / p_permission_codes leaves that part unchanged; a
-- permission list replaces the role's permissions entirely. False when
-- there's no such live system role.
CREATE OR REPLACE FUNCTION admin_update_role(
  p_role_id           uuid,
  p_name              varchar,
  p_permission_codes  varchar[]
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM 1 FROM roles
    WHERE id = p_role_id AND tenant_id IS NULL AND is_system_role
      AND deleted_at IS NULL
    FOR UPDATE;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF p_name IS NOT NULL THEN
    UPDATE roles SET name = p_name WHERE id = p_role_id;
  END IF;

  IF p_permission_codes IS NOT NULL THEN
    DELETE FROM role_permissions WHERE role_id = p_role_id;
    INSERT INTO role_permissions (role_id, permission_id, tenant_id)
    SELECT p_role_id, p.id, NULL
    FROM permissions p
    WHERE p.code = ANY (p_permission_codes);
  END IF;

  RETURN true;
END;
$$;

-- Soft delete. Returns 'deleted', 'not_found', or 'in_use' (still
-- assigned to users — they must be moved to another role first).
CREATE OR REPLACE FUNCTION admin_delete_role(p_role_id uuid)
RETURNS varchar
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM 1 FROM roles
    WHERE id = p_role_id AND tenant_id IS NULL AND is_system_role
      AND deleted_at IS NULL
    FOR UPDATE;
  IF NOT FOUND THEN
    RETURN 'not_found';
  END IF;

  IF EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN users u ON u.id = ur.user_id AND u.deleted_at IS NULL
    WHERE ur.role_id = p_role_id
  ) THEN
    RETURN 'in_use';
  END IF;

  UPDATE roles SET deleted_at = now() WHERE id = p_role_id;
  RETURN 'deleted';
END;
$$;

REVOKE ALL ON FUNCTION admin_list_roles(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_create_role(varchar, varchar[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_update_role(uuid, varchar, varchar[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_delete_role(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_list_roles(uuid) TO field_app;
GRANT EXECUTE ON FUNCTION admin_create_role(varchar, varchar[]) TO field_app;
GRANT EXECUTE ON FUNCTION admin_update_role(uuid, varchar, varchar[]) TO field_app;
GRANT EXECUTE ON FUNCTION admin_delete_role(uuid) TO field_app;

INSERT INTO schema_migrations (version)
VALUES ('0029_admin_roles')
ON CONFLICT (version) DO NOTHING;
