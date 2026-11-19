-- Users → Remove user now deletes the person's Cognito sign-in (the API
-- does that) instead of disabling it, so the email can sign up again — the
-- same outcome as deleting your own account. The removal is no longer
-- recorded in removed_accounts, and signup no longer checks it.
--
-- removed_accounts is kept: rows from earlier removals still mark emails
-- whose sign-in was only disabled, and re-inviting one of them deletes that
-- sign-in first (the API checks the table) and clears the row.

-- Audits the removal in the user's organisation (with the admin who did
-- it) and deletes the account, in one transaction. Returns:
--   'removed'     done
--   'not_found'   no such live user
--   'last_owner'  the last active Owner: no one could manage FIELD after
CREATE OR REPLACE FUNCTION admin_remove_user(p_user_id uuid, p_removed_by uuid)
RETURNS varchar
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_email varchar;
BEGIN
  SELECT u.tenant_id, lower(u.email) INTO v_tenant_id, v_email
  FROM users u
  WHERE u.id = p_user_id AND u.deleted_at IS NULL
  FOR UPDATE OF u;
  IF NOT FOUND THEN
    RETURN 'not_found';
  END IF;

  IF is_last_active_owner(p_user_id) THEN
    RETURN 'last_owner';
  END IF;

  INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, metadata)
  VALUES (v_tenant_id, p_removed_by, 'delete', 'user', p_user_id,
          jsonb_build_object('email', v_email, 'removedByAdmin', true));

  PERFORM delete_user_account(p_user_id, v_tenant_id);
  RETURN 'removed';
END
$$;

REVOKE ALL ON FUNCTION admin_remove_user(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_remove_user(uuid, uuid) TO field_app;

INSERT INTO schema_migrations (version)
VALUES ('0135_admin_remove_deletes_sign_in')
ON CONFLICT (version) DO NOTHING;
