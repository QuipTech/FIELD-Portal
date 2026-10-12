-- Section 1n: inviting a user from the admin portal (Users → Invite user).
-- The backend first creates the person in Cognito (which emails them a
-- temporary password), then calls this with the new Cognito sub. The user
-- starts as 'invited' and becomes 'active' on their first sign-in.
--
-- SECURITY DEFINER because an Owner (the platform administrator) may
-- invite into any organisation, which RLS would refuse. The role must be
-- one that organisation can use: a system role or its own.
CREATE OR REPLACE FUNCTION admin_invite_user(
  p_tenant_id    uuid,
  p_email        varchar,
  p_first_name   varchar,
  p_last_name    varchar,
  p_cognito_sub  varchar,
  p_role_id      uuid
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM roles r
    WHERE r.id = p_role_id AND r.deleted_at IS NULL
      AND (r.tenant_id IS NULL OR r.tenant_id = p_tenant_id)
  ) THEN
    RAISE EXCEPTION 'Role % can''t be assigned in this organisation', p_role_id
      USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO users (tenant_id, email, first_name, last_name, status, cognito_sub, auth_provider)
  VALUES (p_tenant_id, lower(p_email), p_first_name, p_last_name, 'invited', p_cognito_sub, 'password')
  RETURNING id INTO v_user_id;

  INSERT INTO user_roles (user_id, role_id, tenant_id)
  VALUES (v_user_id, p_role_id, p_tenant_id);

  RETURN v_user_id;
END
$$;

REVOKE ALL ON FUNCTION admin_invite_user(uuid, varchar, varchar, varchar, varchar, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_invite_user(uuid, varchar, varchar, varchar, varchar, uuid) TO field_app;

INSERT INTO schema_migrations (version)
VALUES ('0059_user_invitations')
ON CONFLICT (version) DO NOTHING;
