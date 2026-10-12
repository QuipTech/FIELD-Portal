-- Section 1r: an admin can remove a user completely (Users → Remove user).
-- Their FIELD account goes through delete_user_account() (0025 onwards),
-- like deleting your own account; the API also disables their Cognito
-- sign-in. removed_accounts keeps only the email, so the next time they
-- try to sign in — with a password, Google or Apple — the portal can tell
-- them an administrator removed their account instead of offering signup.
-- Inviting the same email again clears it (the API does that).

CREATE TABLE IF NOT EXISTS removed_accounts (
  -- Lower-case, as sign-in compares it.
  email              varchar PRIMARY KEY,
  removed_at         timestamptz NOT NULL DEFAULT now(),
  -- The admin; kept even if their own account is later deleted.
  removed_by         uuid REFERENCES users(id) ON DELETE SET NULL,
  organisation_name  varchar
);

-- Platform data, not any organisation's: no RLS. Sign-in reads it before
-- there is a tenant, and re-inviting deletes the row.
GRANT SELECT, INSERT, UPDATE, DELETE ON removed_accounts TO field_app;

-- The only active Owner left: removing them would leave no one able to
-- manage FIELD (the same rule as Change role, 0061).
CREATE OR REPLACE FUNCTION is_last_active_owner(p_user_id uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = p_user_id AND r.name = 'Owner' AND r.is_system_role
      AND r.tenant_id IS NULL AND r.deleted_at IS NULL)
  AND NOT EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id AND r.name = 'Owner' AND r.is_system_role
                AND r.tenant_id IS NULL AND r.deleted_at IS NULL
    JOIN users u ON u.id = ur.user_id AND u.deleted_at IS NULL AND u.status = 'active'
    WHERE ur.user_id <> p_user_id);
$$;

-- The user to remove, in any organisation: what the API needs to disable
-- their sign-in first. No row: no such live user.
CREATE OR REPLACE FUNCTION admin_find_removable_user(p_user_id uuid)
RETURNS TABLE (
  tenant_id uuid, email varchar, cognito_sub varchar, avatar_storage_key varchar,
  is_last_owner boolean
)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT u.tenant_id, u.email, u.cognito_sub, u.avatar_storage_key,
         is_last_active_owner(u.id)
  FROM users u WHERE u.id = p_user_id AND u.deleted_at IS NULL;
$$;

-- Records the removal, audits it in the user's organisation (with the admin
-- who did it) and deletes the account, in one transaction. Returns:
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
  v_organisation varchar;
BEGIN
  SELECT u.tenant_id, lower(u.email), t.name INTO v_tenant_id, v_email, v_organisation
  FROM users u JOIN tenants t ON t.id = u.tenant_id
  WHERE u.id = p_user_id AND u.deleted_at IS NULL
  FOR UPDATE OF u;
  IF NOT FOUND THEN
    RETURN 'not_found';
  END IF;

  IF is_last_active_owner(p_user_id) THEN
    RETURN 'last_owner';
  END IF;

  INSERT INTO removed_accounts (email, removed_at, removed_by, organisation_name)
  VALUES (v_email, now(), p_removed_by, v_organisation)
  ON CONFLICT (email) DO UPDATE
    SET removed_at = now(), removed_by = EXCLUDED.removed_by,
        organisation_name = EXCLUDED.organisation_name;

  INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, metadata)
  VALUES (v_tenant_id, p_removed_by, 'delete', 'user', p_user_id,
          jsonb_build_object('email', v_email, 'removedByAdmin', true));

  PERFORM delete_user_account(p_user_id, v_tenant_id);
  RETURN 'removed';
END
$$;

REVOKE ALL ON FUNCTION is_last_active_owner(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_find_removable_user(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_remove_user(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_find_removable_user(uuid) TO field_app;
GRANT EXECUTE ON FUNCTION admin_remove_user(uuid, uuid) TO field_app;

INSERT INTO schema_migrations (version)
VALUES ('0077_admin_removed_accounts')
ON CONFLICT (version) DO NOTHING;
