-- Section 8 (cont.): functions that must see the columns 0031 added.
--
-- Sign-in lookups and the admin user list also return avatar_storage_key.
-- Result columns can't change in place, hence DROP + CREATE; otherwise
-- identical to 0026 / 0028.
DROP FUNCTION IF EXISTS auth_lookup_user_by_email(varchar);
CREATE FUNCTION auth_lookup_user_by_email(p_email varchar)
RETURNS TABLE (
  id             uuid,
  tenant_id      uuid,
  password_hash  varchar,
  status         varchar,
  first_name     varchar,
  last_name      varchar,
  avatar_url     varchar,
  avatar_storage_key varchar,
  tenant_status  varchar
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT u.id, u.tenant_id, u.password_hash, u.status,
         u.first_name, u.last_name, u.avatar_url, u.avatar_storage_key, t.status AS tenant_status
  FROM users u
  JOIN tenants t ON t.id = u.tenant_id
  WHERE u.email = p_email
    AND u.deleted_at IS NULL;
$$;

REVOKE ALL ON FUNCTION auth_lookup_user_by_email(varchar) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_lookup_user_by_email(varchar) TO field_app;

DROP FUNCTION IF EXISTS auth_lookup_user_by_cognito_sub(varchar);
CREATE FUNCTION auth_lookup_user_by_cognito_sub(p_cognito_sub varchar)
RETURNS TABLE (
  id             uuid,
  tenant_id      uuid,
  email          varchar,
  status         varchar,
  first_name     varchar,
  last_name      varchar,
  avatar_url     varchar,
  avatar_storage_key varchar,
  tenant_status  varchar
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT u.id, u.tenant_id, u.email, u.status,
         u.first_name, u.last_name, u.avatar_url, u.avatar_storage_key, t.status AS tenant_status
  FROM users u
  JOIN tenants t ON t.id = u.tenant_id
  WHERE u.cognito_sub = p_cognito_sub
    AND u.deleted_at IS NULL;
$$;

REVOKE ALL ON FUNCTION auth_lookup_user_by_cognito_sub(varchar) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_lookup_user_by_cognito_sub(varchar) TO field_app;

DROP FUNCTION IF EXISTS admin_list_users(varchar, varchar, integer, integer);
CREATE FUNCTION admin_list_users(
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
  avatar_storage_key varchar,
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
    SELECT u.id, u.email, u.first_name, u.last_name, u.avatar_url, u.avatar_storage_key, u.status,
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
  SELECT m.id, m.email, m.first_name, m.last_name, m.avatar_url, m.avatar_storage_key, m.status,
         m.last_login_at, m.created_at, m.tenant_id, m.tenant_name, m.roles,
         count(*) OVER () AS total_count
  FROM matching m
  ORDER BY m.created_at DESC, m.id
  LIMIT p_limit OFFSET p_offset;
$$;

REVOKE ALL ON FUNCTION admin_list_users(varchar, varchar, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_list_users(varchar, varchar, integer, integer) TO field_app;

INSERT INTO schema_migrations (version)
VALUES ('0032_file_storage_functions')
ON CONFLICT (version) DO NOTHING;
