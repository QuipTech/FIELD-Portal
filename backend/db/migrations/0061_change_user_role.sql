-- Section 1p: Users → Change role. An Owner gives a user one role,
-- replacing whatever they held. SECURITY DEFINER because the user may be
-- in any organisation and field_app can't delete from user_roles.
--
-- Returns one of:
--   'updated'           the user now holds exactly p_role_id
--   'not_found'         no such live user
--   'role_not_allowed'  not a system role or the user's organisation's own
--   'last_owner'        it would leave no active Owner, locking everyone
--                       out of the admin portal
CREATE OR REPLACE FUNCTION admin_set_user_role(p_user_id uuid, p_role_id uuid)
RETURNS varchar
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_tenant_id   uuid;
  v_owner_role  uuid;
BEGIN
  SELECT tenant_id INTO v_tenant_id FROM users
  WHERE id = p_user_id AND deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN 'not_found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM roles r
    WHERE r.id = p_role_id AND r.deleted_at IS NULL
      AND (r.tenant_id IS NULL OR r.tenant_id = v_tenant_id)
  ) THEN
    RETURN 'role_not_allowed';
  END IF;

  SELECT id INTO v_owner_role FROM roles
  WHERE name = 'Owner' AND is_system_role AND tenant_id IS NULL AND deleted_at IS NULL;

  -- Taking Owner away from the last active Owner is refused.
  IF p_role_id IS DISTINCT FROM v_owner_role
     AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = p_user_id AND role_id = v_owner_role)
     AND NOT EXISTS (
       SELECT 1 FROM user_roles ur
       JOIN users u ON u.id = ur.user_id AND u.deleted_at IS NULL AND u.status = 'active'
       WHERE ur.role_id = v_owner_role AND ur.user_id <> p_user_id
     ) THEN
    RETURN 'last_owner';
  END IF;

  DELETE FROM user_roles WHERE user_id = p_user_id AND role_id <> p_role_id;
  INSERT INTO user_roles (user_id, role_id, tenant_id)
  VALUES (p_user_id, p_role_id, v_tenant_id)
  ON CONFLICT DO NOTHING;
  RETURN 'updated';
END
$$;

REVOKE ALL ON FUNCTION admin_set_user_role(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_set_user_role(uuid, uuid) TO field_app;

INSERT INTO schema_migrations (version)
VALUES ('0061_change_user_role')
ON CONFLICT (version) DO NOTHING;
