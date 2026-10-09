-- Section 5h: the assign dropdown (A13c) lists every active user, support
-- staff first. Only support staff (support.agent: Owner, Support Agent) can
-- be picked; the rest show greyed out, so an admin can see who needs the
-- Support Agent role. The backend still refuses anyone who isn't staff
-- (src/supportCases/adminCaseUpdates.service.ts). The return type changes,
-- so 0073's function is dropped and recreated. "Staff" here matches the
-- API's check (support.agent or platform.manage), so whoever is selectable
-- can then actually open the case.

DROP FUNCTION IF EXISTS admin_list_support_staff();

CREATE FUNCTION admin_list_support_staff()
RETURNS TABLE (
  id uuid, first_name varchar, last_name varchar, email varchar,
  avatar_url varchar, organisation_name varchar, is_admin boolean,
  is_support_staff boolean, open_case_count bigint
)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT u.id, u.first_name, u.last_name, u.email, u.avatar_url, t.name,
         user_has_permission(u.id, 'platform.manage'),
         user_has_permission(u.id, 'support.agent') OR user_has_permission(u.id, 'platform.manage'),
         (SELECT count(*) FROM support_cases c
           WHERE c.assigned_to = u.id AND c.deleted_at IS NULL
             AND c.status IN ('new', 'open', 'waiting_on_customer'))
  FROM users u
  JOIN tenants t ON t.id = u.tenant_id
  WHERE u.deleted_at IS NULL AND u.status = 'active'
  ORDER BY (user_has_permission(u.id, 'support.agent') OR user_has_permission(u.id, 'platform.manage')) DESC, u.first_name, u.last_name;
$$;

REVOKE ALL ON FUNCTION admin_list_support_staff() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_list_support_staff() TO field_app;

INSERT INTO schema_migrations (version)
VALUES ('0074_assignable_users')
ON CONFLICT (version) DO NOTHING;
