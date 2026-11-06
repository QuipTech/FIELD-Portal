-- Machine Control, first part: pairing a machine's tablet (the machine app)
-- to one machine with a 6-digit code.
--   * mc_devices: a tablet paired to a machine; at most one live per machine.
--   * mc_pairing_codes: codes valid 15 minutes, each for one machine only.
--   * mc_device_credentials: the hashed token a paired tablet signs in with.
-- Rows belong to the machine's owning organisation. Portal reads see devices
-- through RLS; codes and credentials are only reached by the functions below.
-- A tablet has no organisation until it pairs, hence SECURITY DEFINER.

CREATE TABLE IF NOT EXISTS mc_devices (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES tenants(id),
  machine_id     uuid NOT NULL REFERENCES machines(id),
  serial_number  varchar,
  platform       varchar CHECK (platform IN ('android', 'windows')),
  app_version    varchar,
  paired_at      timestamptz NOT NULL DEFAULT now(),
  disabled_at    timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  row_version    integer NOT NULL DEFAULT 1,
  deleted_at     timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_mc_devices_live_machine
  ON mc_devices (machine_id) WHERE disabled_at IS NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_mc_devices_tenant ON mc_devices (tenant_id);
DROP TRIGGER IF EXISTS trg_mc_devices_bump_row_version ON mc_devices;
CREATE TRIGGER trg_mc_devices_bump_row_version
  BEFORE UPDATE ON mc_devices
  FOR EACH ROW EXECUTE FUNCTION bump_row_version();

CREATE TABLE IF NOT EXISTS mc_pairing_codes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  machine_id  uuid NOT NULL REFERENCES machines(id),
  code        varchar NOT NULL CHECK (code ~ '^[0-9]{6}$'),
  created_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,
  revoked_at  timestamptz,
  device_id   uuid REFERENCES mc_devices(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);
-- A tablet only sends the code, so a live code is unique across organisations.
CREATE UNIQUE INDEX IF NOT EXISTS uq_mc_pairing_codes_live
  ON mc_pairing_codes (code) WHERE used_at IS NULL AND revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_mc_pairing_codes_machine ON mc_pairing_codes (machine_id);

CREATE TABLE IF NOT EXISTS mc_device_credentials (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  device_id   uuid NOT NULL REFERENCES mc_devices(id),
  token_hash  varchar NOT NULL UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  revoked_at  timestamptz
);
CREATE INDEX IF NOT EXISTS idx_mc_device_credentials_device ON mc_device_credentials (device_id);

ALTER TABLE mc_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE mc_devices FORCE ROW LEVEL SECURITY;
ALTER TABLE mc_pairing_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE mc_pairing_codes FORCE ROW LEVEL SECURITY;
ALTER TABLE mc_device_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE mc_device_credentials FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mc_devices_select ON mc_devices;
CREATE POLICY mc_devices_select ON mc_devices FOR SELECT
  USING (tenant_id = current_tenant_id()
    OR machine_id IN (SELECT machine_id FROM shared_machine_access()));

GRANT SELECT ON mc_devices TO field_app;

-- The machine's owning organisation, if the current person may connect it:
-- their own organisation's machine, or a 'contribute' share. NULL otherwise.
CREATE OR REPLACE FUNCTION mc_connectable_machine_tenant(p_machine_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.tenant_id FROM machines m
  WHERE m.id = p_machine_id AND m.deleted_at IS NULL
    AND (m.tenant_id = current_tenant_id()
      OR can_contribute_to_machine(m.id, m.tenant_id));
$$;

-- A new code for this machine, replacing its earlier ones. NULL when the code
-- is already live elsewhere, so the caller tries another.
CREATE OR REPLACE FUNCTION mc_issue_pairing_code(p_machine_id uuid, p_code varchar)
RETURNS timestamptz
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tenant_id uuid := mc_connectable_machine_tenant(p_machine_id);
  v_expires_at timestamptz;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'machine not connectable' USING ERRCODE = 'insufficient_privilege';
  END IF;
  -- Expired codes go too, which frees their numbers for everyone.
  UPDATE mc_pairing_codes SET revoked_at = now()
  WHERE used_at IS NULL AND revoked_at IS NULL
    AND (machine_id = p_machine_id OR expires_at <= now());
  INSERT INTO mc_pairing_codes (tenant_id, machine_id, code, created_by, expires_at)
  VALUES (v_tenant_id, p_machine_id, p_code, current_app_user_id(), now() + interval '15 minutes')
  ON CONFLICT (code) WHERE used_at IS NULL AND revoked_at IS NULL DO NOTHING
  RETURNING expires_at INTO v_expires_at;
  RETURN v_expires_at;
END;
$$;

-- A tablet redeems a code: no rows when it's wrong, used or expired. The code
-- only works once, and a tablet already on the machine is replaced.
CREATE OR REPLACE FUNCTION mc_pair_device(
  p_code varchar,
  p_token_hash varchar,
  p_serial_number varchar,
  p_platform varchar,
  p_app_version varchar
)
RETURNS TABLE (device_id uuid, machine_id uuid, machine_label varchar)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_code mc_pairing_codes%ROWTYPE;
  v_device_id uuid;
BEGIN
  SELECT c.* INTO v_code FROM mc_pairing_codes c
  JOIN machines m ON m.id = c.machine_id AND m.deleted_at IS NULL
  WHERE c.code = p_code AND c.used_at IS NULL AND c.revoked_at IS NULL AND c.expires_at > now()
  FOR UPDATE OF c;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE mc_device_credentials cr SET revoked_at = now()
  WHERE cr.revoked_at IS NULL AND cr.device_id IN (
    SELECT d.id FROM mc_devices d WHERE d.machine_id = v_code.machine_id AND d.disabled_at IS NULL);
  UPDATE mc_devices d SET disabled_at = now()
  WHERE d.machine_id = v_code.machine_id AND d.disabled_at IS NULL;

  INSERT INTO mc_devices (tenant_id, machine_id, serial_number, platform, app_version)
  VALUES (v_code.tenant_id, v_code.machine_id, p_serial_number, p_platform, p_app_version)
  RETURNING id INTO v_device_id;
  INSERT INTO mc_device_credentials (tenant_id, device_id, token_hash)
  VALUES (v_code.tenant_id, v_device_id, p_token_hash);
  UPDATE mc_pairing_codes c SET used_at = now(), device_id = v_device_id WHERE c.id = v_code.id;

  INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, metadata)
  VALUES (v_code.tenant_id, NULL, 'create', 'mc_device', v_device_id,
    jsonb_build_object('machineId', v_code.machine_id, 'serialNumber', p_serial_number, 'platform', p_platform));

  RETURN QUERY
  SELECT v_device_id, v_code.machine_id,
    COALESCE(NULLIF(m.asset_number, ''), NULLIF(m.fleet_number, ''), m.serial_number)::varchar
  FROM machines m WHERE m.id = v_code.machine_id;
END;
$$;

-- Ends the connection and any code still waiting. False if nothing was connected.
CREATE OR REPLACE FUNCTION mc_disconnect_machine_app(p_machine_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_was_connected boolean;
BEGIN
  IF mc_connectable_machine_tenant(p_machine_id) IS NULL THEN
    RAISE EXCEPTION 'machine not connectable' USING ERRCODE = 'insufficient_privilege';
  END IF;
  UPDATE mc_pairing_codes c SET revoked_at = now()
  WHERE c.machine_id = p_machine_id AND c.used_at IS NULL AND c.revoked_at IS NULL;
  UPDATE mc_device_credentials cr SET revoked_at = now()
  WHERE cr.revoked_at IS NULL AND cr.device_id IN (
    SELECT d.id FROM mc_devices d WHERE d.machine_id = p_machine_id AND d.disabled_at IS NULL);
  UPDATE mc_devices d SET disabled_at = now()
  WHERE d.machine_id = p_machine_id AND d.disabled_at IS NULL;
  GET DIAGNOSTICS v_was_connected = ROW_COUNT;
  RETURN v_was_connected;
END;
$$;

REVOKE ALL ON FUNCTION mc_connectable_machine_tenant(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION mc_issue_pairing_code(uuid, varchar) FROM PUBLIC;
REVOKE ALL ON FUNCTION mc_pair_device(varchar, varchar, varchar, varchar, varchar) FROM PUBLIC;
REVOKE ALL ON FUNCTION mc_disconnect_machine_app(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mc_issue_pairing_code(uuid, varchar) TO field_app;
GRANT EXECUTE ON FUNCTION mc_pair_device(varchar, varchar, varchar, varchar, varchar) TO field_app;
GRANT EXECUTE ON FUNCTION mc_disconnect_machine_app(uuid) TO field_app;

INSERT INTO schema_migrations (version)
VALUES ('0121_machine_app_pairing')
ON CONFLICT (version) DO NOTHING;
