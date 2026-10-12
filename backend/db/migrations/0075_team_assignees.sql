-- Section 5i: support staff are QuipTech's team, as 0073 defines them —
-- anyone holding support.agent or platform.manage, plus everyone in an
-- organisation that has a platform administrator. The API now asks
-- is_support_staff() too (src/supportCases/supportStaffStatus.ts), so the
-- admin can assign any of them, with no role to grant first. 0074's
-- assign dropdown follows the same rule; customers stay greyed out.

CREATE OR REPLACE FUNCTION admin_list_support_staff()
RETURNS TABLE (
  id uuid, first_name varchar, last_name varchar, email varchar,
  avatar_url varchar, organisation_name varchar, is_admin boolean,
  is_support_staff boolean, open_case_count bigint
)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT u.id, u.first_name, u.last_name, u.email, u.avatar_url, t.name,
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

INSERT INTO schema_migrations (version)
VALUES ('0075_team_assignees')
ON CONFLICT (version) DO NOTHING;
