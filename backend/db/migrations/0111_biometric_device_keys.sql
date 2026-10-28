BEGIN;
-- Mobile app biometric sign-in: each phone makes an Ed25519 key pair, keeps
-- the private key behind Face ID / fingerprint, and FIELD stores only the
-- public key. Sign-in signs a single-use, 60-second server challenge.
-- The web portal uses passkeys (0092) instead.

-- One row per phone. Visible and editable only by its owner. Hard-deleted
-- when removed and with the user, so delete_user_account() needs no change.
CREATE TABLE IF NOT EXISTS biometric_keys (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id),
  user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  algorithm        varchar NOT NULL CHECK (algorithm IN ('ed25519')),
  public_key       bytea NOT NULL CHECK (octet_length(public_key) = 32),
  device_type      varchar NOT NULL CHECK (device_type IN ('ios', 'android')),
  app_version      varchar(50),
  failed_attempts  integer NOT NULL DEFAULT 0,
  last_used_at     timestamptz,
  revoked_at       timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  row_version      integer NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_biometric_keys_user_id ON biometric_keys(user_id);

DROP TRIGGER IF EXISTS trg_biometric_keys_bump_row_version ON biometric_keys;
CREATE TRIGGER trg_biometric_keys_bump_row_version
  BEFORE UPDATE ON biometric_keys
  FOR EACH ROW EXECUTE FUNCTION bump_row_version();

ALTER TABLE biometric_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE biometric_keys FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS biometric_keys_owner ON biometric_keys;
CREATE POLICY biometric_keys_owner ON biometric_keys FOR ALL
  USING (tenant_id = current_tenant_id()
    AND user_id = NULLIF(current_setting('app.user_id', true), '')::uuid)
  WITH CHECK (tenant_id = current_tenant_id()
    AND user_id = NULLIF(current_setting('app.user_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON biometric_keys TO field_app;

-- Reached only through the functions below: field_app has no grant.
CREATE TABLE IF NOT EXISTS biometric_challenges (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_id      uuid NOT NULL REFERENCES biometric_keys(id) ON DELETE CASCADE,
  challenge   text NOT NULL,
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_biometric_challenges_expires_at ON biometric_challenges(expires_at);
ALTER TABLE biometric_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE biometric_challenges FORCE ROW LEVEL SECURITY;

-- Sign-in happens before FIELD knows the user's organisation, so the key is
-- found here, across tenants. A revoked key, or one unused for 90 days,
-- is treated as gone.
CREATE OR REPLACE FUNCTION auth_lookup_biometric_key(p_key_id uuid)
RETURNS TABLE (
  id uuid, tenant_id uuid, user_id uuid, public_key bytea, device_type varchar,
  user_status varchar, tenant_status varchar
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT k.id, k.tenant_id, k.user_id, k.public_key, k.device_type, u.status, t.status
  FROM biometric_keys k
  JOIN users u ON u.id = k.user_id AND u.deleted_at IS NULL
  JOIN tenants t ON t.id = k.tenant_id
  WHERE k.id = p_key_id AND k.revoked_at IS NULL
    AND coalesce(k.last_used_at, k.created_at) > now() - interval '90 days';
$$;

CREATE OR REPLACE FUNCTION biometric_issue_challenge(p_key_id uuid, p_challenge text)
RETURNS TABLE (id uuid, expires_at timestamptz)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM biometric_challenges WHERE biometric_challenges.expires_at < now();
  INSERT INTO biometric_challenges (key_id, challenge, expires_at)
  VALUES (p_key_id, p_challenge, now() + interval '60 seconds')
  RETURNING biometric_challenges.id, biometric_challenges.expires_at;
$$;

-- Returns the challenge and deletes it before the signature is checked, so
-- a replay can never pass. NULL when unknown, expired, already used, or
-- issued for another key.
CREATE OR REPLACE FUNCTION biometric_take_challenge(p_id uuid, p_key_id uuid)
RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM biometric_challenges
  WHERE id = p_id AND key_id = p_key_id AND expires_at > now()
  RETURNING challenge;
$$;

-- A bad signature: count it, revoke the key on the fifth in a row, and
-- audit it under the key's owner (nobody is signed in yet).
CREATE OR REPLACE FUNCTION biometric_record_failure(p_key_id uuid, p_ip text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_key biometric_keys%ROWTYPE;
BEGIN
  UPDATE biometric_keys
  SET failed_attempts = failed_attempts + 1,
      revoked_at = CASE WHEN failed_attempts + 1 >= 5 THEN now() ELSE revoked_at END,
      updated_at = now()
  WHERE id = p_key_id
  RETURNING * INTO v_key;
  IF NOT FOUND THEN RETURN; END IF;
  INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, metadata)
  VALUES (v_key.tenant_id, v_key.user_id, 'update', 'biometric_key', v_key.id,
    jsonb_build_object('event', 'sign_in_failed', 'deviceType', v_key.device_type,
      'ip', p_ip, 'revoked', v_key.revoked_at IS NOT NULL));
END $$;

REVOKE ALL ON FUNCTION auth_lookup_biometric_key(uuid), biometric_issue_challenge(uuid, text),
  biometric_take_challenge(uuid, uuid), biometric_record_failure(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_lookup_biometric_key(uuid), biometric_issue_challenge(uuid, text),
  biometric_take_challenge(uuid, uuid), biometric_record_failure(uuid, text) TO field_app;

INSERT INTO schema_migrations (version) VALUES ('0111_biometric_device_keys') ON CONFLICT (version) DO NOTHING;
COMMIT;
