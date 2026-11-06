-- Section 2g (continued): who can see which machine, in the database.
-- Every function reads the request's app.tenant_id and app.user_id (set by
-- the backend per transaction). SECURITY DEFINER with a fixed search_path,
-- so they read the sharing tables whole and RLS policies can call them
-- without recursing. Without app.user_id (background jobs) nothing is
-- shared: those keep seeing only their own organisation, as before.
--   * shared_machine_access(): machines shared with the current person
--     through an active assignment to them or their organisation, minus
--     the owning organisation's exclusions; the highest level wins.
--   * accessible_machines(): what the app lists: own organisation's
--     machines (all of them for 'all' and for admins; only grouped ones
--     for 'groups_only') plus shared machines of other organisations.
--   * is_platform_admin(): the current person holds platform.manage.
--   * can_contribute_to_machine(): 'contribute' on another organisation's
--     machine, i.e. may add history, photos and cases that belong to it.

CREATE OR REPLACE FUNCTION current_app_user_id()
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION is_platform_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM users u
    JOIN user_roles ur ON ur.user_id = u.id
    JOIN roles r ON r.id = ur.role_id AND r.deleted_at IS NULL
    JOIN role_permissions rp ON rp.role_id = r.id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE u.id = current_app_user_id() AND u.tenant_id = current_tenant_id()
      AND u.deleted_at IS NULL AND p.code = 'platform.manage');
$$;

CREATE OR REPLACE FUNCTION shared_machine_access()
RETURNS TABLE (machine_id uuid, tenant_id uuid, access_level varchar)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT gm.machine_id, m.tenant_id,
         (CASE WHEN bool_or(a.access_level = 'contribute') THEN 'contribute'
               ELSE 'view' END)::varchar
  FROM users u
  JOIN machine_group_assignments a ON a.revoked_at IS NULL AND (
         (a.target_type = 'user' AND a.target_id = u.id)
      OR (a.target_type = 'organisation' AND a.target_id = u.tenant_id))
  JOIN machine_groups g ON g.id = a.group_id AND g.deleted_at IS NULL
  JOIN machine_group_machines gm ON gm.group_id = g.id
  JOIN machines m ON m.id = gm.machine_id AND m.deleted_at IS NULL
  WHERE u.id = current_app_user_id() AND u.tenant_id = current_tenant_id()
    AND u.deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM machine_share_exclusions x
      WHERE x.assignment_id = a.id AND x.machine_id = gm.machine_id)
  GROUP BY gm.machine_id, m.tenant_id;
$$;

CREATE OR REPLACE FUNCTION accessible_machines()
RETURNS TABLE (machine_id uuid, tenant_id uuid, access_level varchar, is_shared boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH me AS (
    SELECT u.id, u.tenant_id,
           u.machine_access_mode = 'all' OR EXISTS (
             SELECT 1 FROM user_roles ur
             JOIN roles r ON r.id = ur.role_id AND r.deleted_at IS NULL
             JOIN role_permissions rp ON rp.role_id = r.id
             JOIN permissions p ON p.id = rp.permission_id
             WHERE ur.user_id = u.id
               AND p.code IN ('admin.manage_users', 'platform.manage')) AS sees_own
    FROM users u
    WHERE u.id = current_app_user_id() AND u.tenant_id = current_tenant_id()
      AND u.deleted_at IS NULL
  ),
  shared AS (SELECT * FROM shared_machine_access())
  SELECT m.id, m.tenant_id, 'owner'::varchar, false
  FROM machines m
  WHERE m.tenant_id = current_tenant_id()
    AND (current_app_user_id() IS NULL
         OR EXISTS (SELECT 1 FROM me WHERE me.sees_own)
         OR m.id IN (SELECT s.machine_id FROM shared s))
  UNION ALL
  SELECT s.machine_id, s.tenant_id, s.access_level, true
  FROM shared s
  WHERE s.tenant_id IS DISTINCT FROM current_tenant_id();
$$;

CREATE OR REPLACE FUNCTION can_contribute_to_machine(p_machine_id uuid, p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM shared_machine_access() s
    WHERE s.machine_id = p_machine_id AND s.tenant_id = p_tenant_id
      AND s.access_level = 'contribute');
$$;

-- Groups the current person may know about: assigned to them or their
-- organisation, or holding one of their organisation's machines.
CREATE OR REPLACE FUNCTION visible_machine_group_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.group_id FROM machine_group_assignments a
  JOIN users u ON u.id = current_app_user_id() AND u.tenant_id = current_tenant_id()
  WHERE a.revoked_at IS NULL AND (
         (a.target_type = 'user' AND a.target_id = u.id)
      OR (a.target_type = 'organisation' AND a.target_id = u.tenant_id))
  UNION
  SELECT gm.group_id FROM machine_group_machines gm
  JOIN machines m ON m.id = gm.machine_id
  WHERE m.tenant_id = current_tenant_id();
$$;

-- Groups holding one of the current organisation's machines: its admins
-- see who those machines are shared with.
CREATE OR REPLACE FUNCTION owned_machine_group_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT gm.group_id FROM machine_group_machines gm
  JOIN machines m ON m.id = gm.machine_id
  WHERE m.tenant_id = current_tenant_id();
$$;

REVOKE ALL ON FUNCTION shared_machine_access() FROM PUBLIC;
REVOKE ALL ON FUNCTION accessible_machines() FROM PUBLIC;
REVOKE ALL ON FUNCTION is_platform_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION can_contribute_to_machine(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION visible_machine_group_ids() FROM PUBLIC;
REVOKE ALL ON FUNCTION owned_machine_group_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION shared_machine_access(), accessible_machines(),
  is_platform_admin(), can_contribute_to_machine(uuid, uuid),
  visible_machine_group_ids(), owned_machine_group_ids(), current_app_user_id()
  TO field_app;

-- The sharing tables: only the platform administrator writes them (the
-- owning organisation's exclusions aside).
DROP POLICY IF EXISTS machine_groups_select ON machine_groups;
CREATE POLICY machine_groups_select ON machine_groups FOR SELECT
  USING (is_platform_admin() OR id IN (SELECT visible_machine_group_ids()));
DROP POLICY IF EXISTS machine_groups_insert ON machine_groups;
CREATE POLICY machine_groups_insert ON machine_groups FOR INSERT
  WITH CHECK (is_platform_admin());
DROP POLICY IF EXISTS machine_groups_update ON machine_groups;
CREATE POLICY machine_groups_update ON machine_groups FOR UPDATE
  USING (is_platform_admin()) WITH CHECK (is_platform_admin());

ALTER TABLE machine_group_machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE machine_group_machines FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS machine_group_machines_select ON machine_group_machines;
CREATE POLICY machine_group_machines_select ON machine_group_machines FOR SELECT
  USING (is_platform_admin() OR machine_id IN (SELECT id FROM machines));
DROP POLICY IF EXISTS machine_group_machines_insert ON machine_group_machines;
CREATE POLICY machine_group_machines_insert ON machine_group_machines FOR INSERT
  WITH CHECK (is_platform_admin());
DROP POLICY IF EXISTS machine_group_machines_delete ON machine_group_machines;
CREATE POLICY machine_group_machines_delete ON machine_group_machines FOR DELETE
  USING (is_platform_admin());
GRANT SELECT, INSERT, DELETE ON machine_group_machines TO field_app;

ALTER TABLE machine_group_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE machine_group_assignments FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS machine_group_assignments_select ON machine_group_assignments;
CREATE POLICY machine_group_assignments_select ON machine_group_assignments FOR SELECT
  USING (is_platform_admin()
    OR (target_type = 'user' AND target_id = current_app_user_id())
    OR (target_type = 'organisation' AND target_id = current_tenant_id())
    OR group_id IN (SELECT owned_machine_group_ids()));
DROP POLICY IF EXISTS machine_group_assignments_insert ON machine_group_assignments;
CREATE POLICY machine_group_assignments_insert ON machine_group_assignments FOR INSERT
  WITH CHECK (is_platform_admin());
DROP POLICY IF EXISTS machine_group_assignments_update ON machine_group_assignments;
CREATE POLICY machine_group_assignments_update ON machine_group_assignments FOR UPDATE
  USING (is_platform_admin()) WITH CHECK (is_platform_admin());
GRANT SELECT, INSERT, UPDATE ON machine_group_assignments TO field_app;

ALTER TABLE machine_share_exclusions ENABLE ROW LEVEL SECURITY;
ALTER TABLE machine_share_exclusions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS machine_share_exclusions_select ON machine_share_exclusions;
CREATE POLICY machine_share_exclusions_select ON machine_share_exclusions FOR SELECT
  USING (is_platform_admin() OR tenant_id = current_tenant_id());
DROP POLICY IF EXISTS machine_share_exclusions_insert ON machine_share_exclusions;
CREATE POLICY machine_share_exclusions_insert ON machine_share_exclusions FOR INSERT
  WITH CHECK (tenant_id = current_tenant_id() AND EXISTS (
    SELECT 1 FROM machines m
    WHERE m.id = machine_id AND m.tenant_id = current_tenant_id()));
GRANT SELECT, INSERT ON machine_share_exclusions TO field_app;

INSERT INTO schema_migrations (version)
VALUES ('0116_machine_sharing_access')
ON CONFLICT (version) DO NOTHING;
