-- Section 5g: support staff are QuipTech's people, not only role holders.
-- Anyone in an organisation that has a platform administrator (Owner —
-- QuipTech's own organisation) can be assigned a case, plus anyone
-- holding support.agent or platform.manage. Being assigned is what lets
-- them open that one case (src/supportCases/caseAccessPolicy.ts);
-- customers from other organisations are never staff.

CREATE OR REPLACE FUNCTION is_support_staff(p_user_id uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT user_has_permission(p_user_id, 'support.agent')
      OR user_has_permission(p_user_id, 'platform.manage')
      OR EXISTS (
        SELECT 1 FROM users me
        JOIN users colleague ON colleague.tenant_id = me.tenant_id
        WHERE me.id = p_user_id AND me.deleted_at IS NULL
          AND colleague.deleted_at IS NULL AND colleague.status = 'active'
          AND user_has_permission(colleague.id, 'platform.manage')
      );
$$;

-- 0070's, with staff by is_support_staff.
CREATE OR REPLACE FUNCTION support_case_person(p_user_id uuid)
RETURNS TABLE (
  id uuid, tenant_id uuid, first_name varchar, last_name varchar, email varchar,
  avatar_url varchar, avatar_storage_key varchar, is_admin boolean
)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT u.id, u.tenant_id, u.first_name, u.last_name, u.email,
         u.avatar_url, u.avatar_storage_key,
         user_has_permission(u.id, 'platform.manage')
  FROM users u
  WHERE u.id = p_user_id AND u.deleted_at IS NULL
    AND (u.tenant_id = current_tenant_id() OR is_support_staff(u.id));
$$;

-- 0071's assign dropdown, with staff by is_support_staff.
CREATE OR REPLACE FUNCTION admin_list_support_staff()
RETURNS TABLE (
  id uuid, first_name varchar, last_name varchar, email varchar,
  avatar_url varchar, is_admin boolean, open_case_count bigint
)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT u.id, u.first_name, u.last_name, u.email, u.avatar_url,
         user_has_permission(u.id, 'platform.manage'),
         (SELECT count(*) FROM support_cases c
           WHERE c.assigned_to = u.id AND c.deleted_at IS NULL
             AND c.status IN ('new', 'open', 'waiting_on_customer'))
  FROM users u
  WHERE u.deleted_at IS NULL AND u.status = 'active'
    AND is_support_staff(u.id)
  ORDER BY u.first_name, u.last_name;
$$;

REVOKE ALL ON FUNCTION is_support_staff(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_support_staff(uuid) TO field_app;

INSERT INTO schema_migrations (version)
VALUES ('0073_support_staff_members')
ON CONFLICT (version) DO NOTHING;
