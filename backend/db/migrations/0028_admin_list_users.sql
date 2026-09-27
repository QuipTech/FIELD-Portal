-- Section 1h: platform-wide user directory for the admin portal's Users
-- page. Every self-serve signup gets its own tenant, so listing users
-- across the platform has to read past RLS — like the auth_lookup_*
-- functions (0003/0023) this is SECURITY DEFINER, owned by the migration
-- role, and callable only by field_app. The database can't tell who the
-- caller is, so the backend's RequireRolesGuard (Owner only) is what
-- restricts it; never call it from an unguarded route.
--
-- p_search matches name, email, or organisation name (the caller escapes
-- LIKE wildcards). p_role keeps users holding that role name. NULL skips
-- either filter. total_count is the full match count, for pagination.

CREATE OR REPLACE FUNCTION admin_list_users(
  p_search  varchar,
  p_role    varchar,
  p_limit   integer,
  p_offset  integer
)
RETURNS TABLE (
  id             uuid,
  email          varchar,
  first_name     varchar,
  last_name      varchar,
  avatar_url     varchar,
  status         varchar,
  last_login_at  timestamptz,
  created_at     timestamptz,
  tenant_id      uuid,
  tenant_name    varchar,
  roles          varchar[],
  total_count    bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  WITH user_role_names AS (
    SELECT ur.user_id, array_agg(r.name ORDER BY r.name) AS roles
    FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id AND r.deleted_at IS NULL
    GROUP BY ur.user_id
  ),
  matching AS (
    SELECT u.id, u.email, u.first_name, u.last_name, u.avatar_url, u.status,
           u.last_login_at, u.created_at, t.id AS tenant_id,
           t.name AS tenant_name,
           COALESCE(urn.roles, '{}'::varchar[]) AS roles
    FROM users u
    JOIN tenants t ON t.id = u.tenant_id
    LEFT JOIN user_role_names urn ON urn.user_id = u.id
    WHERE u.deleted_at IS NULL
      AND (
        p_search IS NULL
        OR u.email ILIKE '%' || p_search || '%'
        OR (u.first_name || ' ' || u.last_name) ILIKE '%' || p_search || '%'
        OR t.name ILIKE '%' || p_search || '%'
      )
      AND (p_role IS NULL OR p_role = ANY (COALESCE(urn.roles, '{}'::varchar[])))
  )
  SELECT m.id, m.email, m.first_name, m.last_name, m.avatar_url, m.status,
         m.last_login_at, m.created_at, m.tenant_id, m.tenant_name, m.roles,
         count(*) OVER () AS total_count
  FROM matching m
  ORDER BY m.created_at DESC, m.id
  LIMIT p_limit OFFSET p_offset;
$$;

REVOKE ALL ON FUNCTION admin_list_users(varchar, varchar, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_list_users(varchar, varchar, integer, integer) TO field_app;

INSERT INTO schema_migrations (version)
VALUES ('0028_admin_list_users')
ON CONFLICT (version) DO NOTHING;
