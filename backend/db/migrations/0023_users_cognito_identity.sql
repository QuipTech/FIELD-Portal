-- Section 1d: links a users row to its AWS Cognito identity (Google /
-- Apple federated sign-in via the Cognito hosted UI). Email/password login
-- keeps using password_hash and our own sessions; cognito_sub is set once a
-- user has signed in, or signed up, through Cognito.

ALTER TABLE users ADD COLUMN IF NOT EXISTS cognito_sub varchar;
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider varchar NOT NULL DEFAULT 'password';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_auth_provider_check'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_auth_provider_check
      CHECK (auth_provider IN ('password', 'google', 'apple'));
  END IF;
END $$;

-- Users who sign up through Google/Apple never set a FIELD password, but
-- every user must still have at least one way to sign in.
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_sign_in_method_check'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_sign_in_method_check
      CHECK (password_hash IS NOT NULL OR cognito_sub IS NOT NULL);
  END IF;
END $$;

-- Unique index doubles as the lookup index for sign-in by Cognito sub.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_cognito_sub ON users(cognito_sub);

-- Same reasoning as auth_lookup_user_by_email (0003): a Cognito sign-in
-- arrives with no tenant context, so the lookup must bypass RLS. Owned by
-- the migration role, callable only by field_app, returns only what auth
-- needs.
CREATE OR REPLACE FUNCTION auth_lookup_user_by_cognito_sub(p_cognito_sub varchar)
RETURNS TABLE (
  id             uuid,
  tenant_id      uuid,
  email          varchar,
  status         varchar,
  first_name     varchar,
  last_name      varchar,
  tenant_status  varchar
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT u.id, u.tenant_id, u.email, u.status,
         u.first_name, u.last_name, t.status AS tenant_status
  FROM users u
  JOIN tenants t ON t.id = u.tenant_id
  WHERE u.cognito_sub = p_cognito_sub
    AND u.deleted_at IS NULL;
$$;

REVOKE ALL ON FUNCTION auth_lookup_user_by_cognito_sub(varchar) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_lookup_user_by_cognito_sub(varchar) TO field_app;

INSERT INTO schema_migrations (version)
VALUES ('0023_users_cognito_identity')
ON CONFLICT (version) DO NOTHING;
