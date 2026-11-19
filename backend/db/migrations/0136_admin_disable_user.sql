-- Users → Disable user / Enable user (the Owner, any organisation). A
-- disabled person keeps their account and data but can't sign in: sign-in
-- tells them an administrator disabled their account. Disabling also ends
-- their sessions, so a refresh can't keep them signed in. Enabling puts
-- them back to 'active', or to 'invited' if they never signed in.
-- Returns:
--   'updated'     done (or already in that state)
--   'not_found'   no such live user
--   'last_owner'  disabling the last active Owner: no one could manage FIELD
CREATE OR REPLACE FUNCTION admin_set_user_disabled(p_user_id uuid, p_disabled boolean)
RETURNS varchar
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_status varchar;
BEGIN
  SELECT status INTO v_status FROM users
  WHERE id = p_user_id AND deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN 'not_found';
  END IF;

  IF p_disabled THEN
    IF v_status = 'disabled' THEN
      RETURN 'updated';
    END IF;
    IF is_last_active_owner(p_user_id) THEN
      RETURN 'last_owner';
    END IF;
    UPDATE users SET status = 'disabled', updated_at = now() WHERE id = p_user_id;
    DELETE FROM sessions WHERE user_id = p_user_id;
  ELSIF v_status = 'disabled' THEN
    UPDATE users
    SET status = CASE WHEN last_login_at IS NULL THEN 'invited' ELSE 'active' END,
        updated_at = now()
    WHERE id = p_user_id;
  END IF;
  RETURN 'updated';
END
$$;

REVOKE ALL ON FUNCTION admin_set_user_disabled(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_set_user_disabled(uuid, boolean) TO field_app;

INSERT INTO schema_migrations (version)
VALUES ('0136_admin_disable_user')
ON CONFLICT (version) DO NOTHING;
