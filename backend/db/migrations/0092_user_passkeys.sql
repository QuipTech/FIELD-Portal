BEGIN;
-- Passkey (WebAuthn) sign-in: Face ID, Touch ID, Windows Hello. The device
-- keeps the private key; FIELD stores only the public key and checks each
-- sign-in's signature against a single-use, server-issued challenge.

-- One row per enrolled device. Visible and editable only by its owner.
-- Hard-deleted when removed (a revoked key has nothing worth keeping) and
-- with the user, so delete_user_account() needs no change.
CREATE TABLE IF NOT EXISTS user_passkeys (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES tenants(id),
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credential_id  text NOT NULL UNIQUE,
  public_key     bytea NOT NULL,
  sign_count     bigint NOT NULL DEFAULT 0,
  transports     text[] NOT NULL DEFAULT '{}',
  device_name    varchar(100) NOT NULL,
  backed_up      boolean NOT NULL DEFAULT false,
  last_used_at   timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  row_version    integer NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_user_passkeys_user_id ON user_passkeys(user_id);

DROP TRIGGER IF EXISTS trg_user_passkeys_bump_row_version ON user_passkeys;
CREATE TRIGGER trg_user_passkeys_bump_row_version
  BEFORE UPDATE ON user_passkeys
  FOR EACH ROW EXECUTE FUNCTION bump_row_version();

ALTER TABLE user_passkeys ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_passkeys FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_passkeys_owner ON user_passkeys;
CREATE POLICY user_passkeys_owner ON user_passkeys FOR ALL
  USING (tenant_id = current_tenant_id()
    AND user_id = NULLIF(current_setting('app.user_id', true), '')::uuid)
  WITH CHECK (tenant_id = current_tenant_id()
    AND user_id = NULLIF(current_setting('app.user_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON user_passkeys TO field_app;

-- Challenges live five minutes and are deleted when used, so each one
-- signs in (or enrols) at most once. Reached only through the functions
-- below: field_app has no grant on the table.
CREATE TABLE IF NOT EXISTS webauthn_challenges (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purpose     varchar NOT NULL CHECK (purpose IN ('register', 'login')),
  challenge   text NOT NULL,
  user_id     uuid REFERENCES users(id) ON DELETE CASCADE,
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_expires_at ON webauthn_challenges(expires_at);
ALTER TABLE webauthn_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE webauthn_challenges FORCE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION webauthn_issue_challenge(p_purpose varchar, p_challenge text, p_user uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  DELETE FROM webauthn_challenges WHERE expires_at < now();
  INSERT INTO webauthn_challenges (purpose, challenge, user_id, expires_at)
  VALUES (p_purpose, p_challenge, p_user, now() + interval '5 minutes')
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- Returns the challenge and deletes it; NULL when it is unknown, expired,
-- already used, or was issued for another purpose or user.
CREATE OR REPLACE FUNCTION webauthn_take_challenge(p_id uuid, p_purpose varchar, p_user uuid)
RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM webauthn_challenges
  WHERE id = p_id AND purpose = p_purpose AND user_id IS NOT DISTINCT FROM p_user
    AND expires_at > now()
  RETURNING challenge;
$$;

-- Sign-in happens before FIELD knows the user's organisation, so the
-- credential is found here, across tenants, with what deciding the
-- sign-in needs.
CREATE OR REPLACE FUNCTION auth_lookup_passkey(p_credential_id text)
RETURNS TABLE (
  id uuid, tenant_id uuid, user_id uuid, public_key bytea, sign_count bigint,
  transports text[], user_status varchar, tenant_status varchar
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.tenant_id, p.user_id, p.public_key, p.sign_count, p.transports,
         u.status, t.status
  FROM user_passkeys p
  JOIN users u ON u.id = p.user_id AND u.deleted_at IS NULL
  JOIN tenants t ON t.id = p.tenant_id
  WHERE p.credential_id = p_credential_id;
$$;

REVOKE ALL ON FUNCTION webauthn_issue_challenge(varchar, text, uuid),
  webauthn_take_challenge(uuid, varchar, uuid), auth_lookup_passkey(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION webauthn_issue_challenge(varchar, text, uuid),
  webauthn_take_challenge(uuid, varchar, uuid), auth_lookup_passkey(text) TO field_app;

INSERT INTO schema_migrations (version) VALUES ('0092_user_passkeys') ON CONFLICT (version) DO NOTHING;
COMMIT;
