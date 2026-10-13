-- The assign dropdown shows each person's role ("Technical Manager · 2
-- open") instead of calling every non-admin a Support Agent. Adds
-- role_name to 0075's admin_list_support_staff(); the return type
-- changes, so it is dropped and recreated.

DROP FUNCTION IF EXISTS admin_list_support_staff();

CREATE FUNCTION admin_list_support_staff()
RETURNS TABLE (
  id uuid, first_name varchar, last_name varchar, email varchar,
  avatar_url varchar, organisation_name varchar, role_name varchar,
  is_admin boolean, is_support_staff boolean, open_case_count bigint
)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT u.id, u.first_name, u.last_name, u.email, u.avatar_url, t.name,
         (SELECT r.name FROM user_roles ur JOIN roles r ON r.id = ur.role_id
           WHERE ur.user_id = u.id AND r.deleted_at IS NULL
           ORDER BY r.name LIMIT 1),
         user_has_permission(u.id, 'platform.manage'),
         is_support_staff(u.id),
         (SELECT count(*) FROM support_cases c
           WHERE c.assigned_to = u.id AND c.deleted_at IS NULL
             AND c.status IN ('new', 'open', 'waiting_on_customer'))
  FROM users u
  JOIN tenants t ON t.id = u.tenant_id
  WHERE u.deleted_at IS NULL AND u.status = 'active'
  ORDER BY is_support_staff(u.id) DESC, u.first_name, u.last_name;
$$;

REVOKE ALL ON FUNCTION admin_list_support_staff() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_list_support_staff() TO field_app;

INSERT INTO schema_migrations (version)
VALUES ('0083_support_staff_role_names')
ON CONFLICT (version) DO NOTHING;
