-- Section 2g (continued): what the sharing screens read across
-- organisations. RLS keeps every organisation's machines and people to
-- itself, so these SECURITY DEFINER functions check the caller first and
-- return only what the screen needs:
--   * admin_*: the platform administrator (is_platform_admin()) searching
--     every organisation's machines, listing a group's machines and its
--     assignments (with the people's and organisations' names), and
--     checking a person exists before they are given a group.
--   * owned_machine_shares(): an organisation's admin seeing who one of
--     its OWN machines is shared with (the backend checks the permission).
--   * notify_machine_share_revoked(): tells every platform administrator
--     that an owning organisation withdrew one of its machines from a share.

CREATE OR REPLACE FUNCTION assert_platform_admin()
RETURNS void LANGUAGE plpgsql STABLE AS $$
BEGIN
  IF NOT is_platform_admin() THEN
    RAISE EXCEPTION 'platform administrator only' USING ERRCODE = '42501';
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION admin_search_machines(p_search text, p_limit integer)
RETURNS TABLE (
  id uuid, label varchar, serial_number varchar, registration_number varchar,
  model_name varchar, manufacturer_name varchar, status varchar,
  lifecycle_state varchar, tenant_id uuid, organisation_name varchar
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM assert_platform_admin();
  RETURN QUERY
  SELECT m.id, COALESCE(NULLIF(m.asset_number, ''), NULLIF(m.fleet_number, ''), m.serial_number)::varchar,
         m.serial_number, m.registration_number, mm.name, mf.name, m.status,
         m.lifecycle_state, m.tenant_id, t.name
  FROM machines m
  JOIN machine_models mm ON mm.id = m.model_id
  JOIN machine_manufacturers mf ON mf.id = m.manufacturer_id
  JOIN tenants t ON t.id = m.tenant_id
  WHERE m.deleted_at IS NULL
    AND (p_search IS NULL
      OR m.asset_number ILIKE p_search OR m.fleet_number ILIKE p_search
      OR m.serial_number ILIKE p_search OR m.registration_number ILIKE p_search
      OR t.name ILIKE p_search)
  ORDER BY lower(t.name), 2, m.id
  LIMIT p_limit;
END
$$;

CREATE OR REPLACE FUNCTION admin_list_group_machines(p_group_id uuid)
RETURNS TABLE (
  id uuid, label varchar, serial_number varchar, model_name varchar,
  manufacturer_name varchar, status varchar, lifecycle_state varchar,
  tenant_id uuid, organisation_name varchar, added_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM assert_platform_admin();
  RETURN QUERY
  SELECT m.id, COALESCE(NULLIF(m.asset_number, ''), NULLIF(m.fleet_number, ''), m.serial_number)::varchar,
         m.serial_number, mm.name, mf.name, m.status, m.lifecycle_state,
         m.tenant_id, t.name, gm.added_at
  FROM machine_group_machines gm
  JOIN machines m ON m.id = gm.machine_id AND m.deleted_at IS NULL
  JOIN machine_models mm ON mm.id = m.model_id
  JOIN machine_manufacturers mf ON mf.id = m.manufacturer_id
  JOIN tenants t ON t.id = m.tenant_id
  WHERE gm.group_id = p_group_id
  ORDER BY lower(t.name), 2, m.id;
END
$$;

CREATE OR REPLACE FUNCTION admin_list_group_assignments(p_group_id uuid)
RETURNS TABLE (
  id uuid, target_type varchar, target_id uuid, target_name varchar,
  target_email varchar, organisation_id uuid, organisation_name varchar,
  access_level varchar, granted_by_name varchar, granted_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM assert_platform_admin();
  RETURN QUERY
  SELECT a.id, a.target_type, a.target_id,
         COALESCE(trim(u.first_name || ' ' || u.last_name), t.name)::varchar,
         u.email, COALESCE(u.tenant_id, t.id), COALESCE(ut.name, t.name),
         a.access_level, trim(g.first_name || ' ' || g.last_name)::varchar, a.granted_at
  FROM machine_group_assignments a
  LEFT JOIN users u ON a.target_type = 'user' AND u.id = a.target_id
  LEFT JOIN tenants ut ON ut.id = u.tenant_id
  LEFT JOIN tenants t ON a.target_type = 'organisation' AND t.id = a.target_id
  LEFT JOIN users g ON g.id = a.granted_by
  WHERE a.group_id = p_group_id AND a.revoked_at IS NULL
  ORDER BY a.target_type, 4, a.id;
END
$$;

-- The person a 'user' assignment would go to, or nothing.
CREATE OR REPLACE FUNCTION admin_find_user(p_user_id uuid)
RETURNS TABLE (id uuid, tenant_id uuid, name varchar, email varchar)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM assert_platform_admin();
  RETURN QUERY
  SELECT u.id, u.tenant_id, trim(u.first_name || ' ' || u.last_name)::varchar, u.email
  FROM users u WHERE u.id = p_user_id AND u.deleted_at IS NULL;
END
$$;

-- Live machines among p_ids with their owning organisation.
CREATE OR REPLACE FUNCTION admin_find_machines(p_ids uuid[])
RETURNS TABLE (id uuid, tenant_id uuid, label varchar)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM assert_platform_admin();
  RETURN QUERY
  SELECT m.id, m.tenant_id,
         COALESCE(NULLIF(m.asset_number, ''), NULLIF(m.fleet_number, ''), m.serial_number)::varchar
  FROM machines m WHERE m.id = ANY(p_ids) AND m.deleted_at IS NULL;
END
$$;

CREATE OR REPLACE FUNCTION owned_machine_shares(p_machine_id uuid)
RETURNS TABLE (
  assignment_id uuid, group_id uuid, group_name varchar, group_colour varchar,
  target_type varchar, target_name varchar, organisation_name varchar,
  access_level varchar, granted_at timestamptz,
  withdrawn_at timestamptz, withdrawn_reason text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.id, g.id, g.name, g.colour, a.target_type,
         COALESCE(trim(u.first_name || ' ' || u.last_name), t.name)::varchar,
         COALESCE(ut.name, t.name), a.access_level, a.granted_at,
         x.created_at, x.reason
  FROM machines m
  JOIN machine_group_machines gm ON gm.machine_id = m.id
  JOIN machine_groups g ON g.id = gm.group_id AND g.deleted_at IS NULL
  JOIN machine_group_assignments a ON a.group_id = g.id AND a.revoked_at IS NULL
  LEFT JOIN users u ON a.target_type = 'user' AND u.id = a.target_id
  LEFT JOIN tenants ut ON ut.id = u.tenant_id
  LEFT JOIN tenants t ON a.target_type = 'organisation' AND t.id = a.target_id
  LEFT JOIN machine_share_exclusions x
    ON x.assignment_id = a.id AND x.machine_id = m.id
  WHERE m.id = p_machine_id AND m.tenant_id = current_tenant_id()
    AND m.deleted_at IS NULL
  ORDER BY lower(g.name), a.target_type, 6, a.id;
$$;

-- People's machine access: their stored mode, whether a role makes them an
-- admin (always their whole organisation), and the groups assigned to them
-- or their organisation with the highest level. For the platform
-- administrator (anyone), and otherwise only people of the caller's own
-- organisation (GET /auth/me, the Team screen).
CREATE OR REPLACE FUNCTION users_machine_access(p_user_ids uuid[])
RETURNS TABLE (user_id uuid, machine_access_mode varchar, is_admin boolean, groups json)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT u.id, u.machine_access_mode,
         EXISTS (
           SELECT 1 FROM user_roles ur
           JOIN roles r ON r.id = ur.role_id AND r.deleted_at IS NULL
           JOIN role_permissions rp ON rp.role_id = r.id
           JOIN permissions p ON p.id = rp.permission_id
           WHERE ur.user_id = u.id
             AND p.code IN ('admin.manage_users', 'platform.manage')),
         COALESCE((
           SELECT json_agg(json_build_object('id', x.id, 'name', x.name,
                    'colour', x.colour, 'accessLevel', x.access_level)
                  ORDER BY lower(x.name), x.id)
           FROM (
             SELECT g.id, g.name, g.colour,
                    CASE WHEN bool_or(a.access_level = 'contribute')
                         THEN 'contribute' ELSE 'view' END AS access_level
             FROM machine_group_assignments a
             JOIN machine_groups g ON g.id = a.group_id AND g.deleted_at IS NULL
             WHERE a.revoked_at IS NULL
               AND ((a.target_type = 'user' AND a.target_id = u.id)
                 OR (a.target_type = 'organisation' AND a.target_id = u.tenant_id))
             GROUP BY g.id, g.name, g.colour
           ) x), '[]'::json)
  FROM users u
  WHERE u.id = ANY(p_user_ids) AND u.deleted_at IS NULL
    AND (u.tenant_id = current_tenant_id() OR is_platform_admin());
$$;

REVOKE ALL ON FUNCTION users_machine_access(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION users_machine_access(uuid[]) TO field_app;

-- The organisation of someone the reader can't see (users RLS), shown
-- instead of their name on a shared machine's history: the owner's people
-- to a shared reader, a contributor's organisation to the owner.
CREATE OR REPLACE FUNCTION person_organisation_name(p_user_id uuid)
RETURNS varchar
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.name FROM users u JOIN tenants t ON t.id = u.tenant_id
  WHERE u.id = p_user_id;
$$;

REVOKE ALL ON FUNCTION person_organisation_name(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION person_organisation_name(uuid) TO field_app;

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_kind_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_kind_check CHECK (kind IN (
  'case_message', 'case_assigned', 'case_status', 'case_priority',
  'machine_status', 'ai_review', 'knowledge_document', 'alert', 'billing',
  'machine_sharing'));

CREATE OR REPLACE FUNCTION notify_machine_share_revoked(
  p_machine_id uuid, p_group_id uuid, p_reason text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_label varchar;
  v_group varchar;
  v_organisation varchar;
BEGIN
  SELECT COALESCE(NULLIF(m.asset_number, ''), NULLIF(m.fleet_number, ''), m.serial_number), t.name
    INTO v_label, v_organisation
  FROM machines m JOIN tenants t ON t.id = m.tenant_id
  WHERE m.id = p_machine_id AND m.tenant_id = current_tenant_id();
  IF v_label IS NULL THEN
    RAISE EXCEPTION 'machine not in this organisation' USING ERRCODE = '42501';
  END IF;
  SELECT name INTO v_group FROM machine_groups WHERE id = p_group_id;
  PERFORM notify_users(
    ARRAY(SELECT u.id FROM users u
          JOIN user_roles ur ON ur.user_id = u.id
          JOIN roles r ON r.id = ur.role_id AND r.deleted_at IS NULL
          JOIN role_permissions rp ON rp.role_id = r.id
          JOIN permissions p ON p.id = rp.permission_id AND p.code = 'platform.manage'
          WHERE u.deleted_at IS NULL),
    NULL, 'machine_sharing',
    v_organisation || ' withdrew ' || v_label || ' from ' || COALESCE(v_group, 'a group'),
    left(p_reason, 200), '/admin/machine-groups/' || p_group_id);
END
$$;

REVOKE ALL ON FUNCTION assert_platform_admin(), admin_search_machines(text, integer),
  admin_list_group_machines(uuid), admin_list_group_assignments(uuid),
  admin_find_user(uuid), admin_find_machines(uuid[]), owned_machine_shares(uuid),
  notify_machine_share_revoked(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION assert_platform_admin(), admin_search_machines(text, integer),
  admin_list_group_machines(uuid), admin_list_group_assignments(uuid),
  admin_find_user(uuid), admin_find_machines(uuid[]), owned_machine_shares(uuid),
  notify_machine_share_revoked(uuid, uuid, text) TO field_app;

INSERT INTO schema_migrations (version)
VALUES ('0119_machine_sharing_admin_functions')
ON CONFLICT (version) DO NOTHING;
