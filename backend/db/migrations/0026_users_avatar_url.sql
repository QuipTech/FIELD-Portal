-- Section 1g: profile photo on users. Filled from the Google `picture`
-- claim on every Google sign-in (Google photo URLs can change), never
-- cleared by a sign-in that carries no photo (Apple, email/password).

ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url varchar;

-- Both sign-in lookups also return avatar_url so every session — email/
-- password included — can carry the photo. A function's result columns
-- can't be changed in place, hence DROP + CREATE. Otherwise identical to
-- 0003 / 0023.
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
  tenant_status  varchar
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT u.id, u.tenant_id, u.password_hash, u.status,
         u.first_name, u.last_name, u.avatar_url, t.status AS tenant_status
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
  tenant_status  varchar
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT u.id, u.tenant_id, u.email, u.status,
         u.first_name, u.last_name, u.avatar_url, t.status AS tenant_status
  FROM users u
  JOIN tenants t ON t.id = u.tenant_id
  WHERE u.cognito_sub = p_cognito_sub
    AND u.deleted_at IS NULL;
$$;

REVOKE ALL ON FUNCTION auth_lookup_user_by_cognito_sub(varchar) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_lookup_user_by_cognito_sub(varchar) TO field_app;

INSERT INTO schema_migrations (version)
VALUES ('0026_users_avatar_url')
ON CONFLICT (version) DO NOTHING;
