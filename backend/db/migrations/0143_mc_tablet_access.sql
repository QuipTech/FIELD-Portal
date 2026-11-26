-- Machine Control: a tablet connects with a permanent FIELD ID and a password
-- instead of a 6-digit code, and remote sessions to it need no answer on the
-- tablet.
--   * A tablet registers itself (signed out) and gets a 9-digit FIELD ID and a
--     permanent tablet token. The token only reads its registration and, once
--     a Portal person has added it to a machine, collects a device token: the
--     same one paired tablets use for everything else (0121, 0128).
--   * Adding it takes the ID and password. The first organisation to add a
--     tablet keeps it: nobody else can add or reach it afterwards.
--   * Five wrong passwords lock the tablet for 15 minutes.
--   * A session to a registered tablet starts 'active' at once
--     (access_mode 'unattended'). Tablets paired with a code have no
--     registration and keep Allow/Decline ('prompt').
-- mc_tablets holds password hashes: no grant, only the functions below.

CREATE TABLE IF NOT EXISTS mc_tablets (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id        varchar NOT NULL UNIQUE CHECK (field_id ~ '^[1-9][0-9]{8}$'),
  password_hash   varchar NOT NULL,
  token_hash      varchar NOT NULL UNIQUE,
  serial_number   varchar,
  platform        varchar CHECK (platform IN ('android', 'windows')),
  app_version     varchar,
  -- The organisation that first added it; NULL until then.
  tenant_id       uuid REFERENCES tenants(id) ON DELETE SET NULL,
  -- The machine connection it is on now; a disabled one means it was removed.
  device_id       uuid UNIQUE REFERENCES mc_devices(id) ON DELETE SET NULL,
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE mc_tablets ENABLE ROW LEVEL SECURITY;
ALTER TABLE mc_tablets FORCE ROW LEVEL SECURITY;

-- Registers a tablet and returns its FIELD ID. p_device_token_hash is set by
-- a tablet already paired with a code: it keeps its machine. Error:
-- tablet_device_token_invalid.
CREATE OR REPLACE FUNCTION mc_tablet_register(
  p_password_hash varchar, p_token_hash varchar, p_serial_number varchar,
  p_platform varchar, p_app_version varchar, p_device_token_hash varchar)
RETURNS varchar
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_device_id uuid;
  v_tenant_id uuid;
  v_field_id varchar;
BEGIN
  IF p_device_token_hash IS NOT NULL THEN
    SELECT d.device_id, d.tenant_id INTO v_device_id, v_tenant_id
    FROM mc_device_for_token(p_device_token_hash) d;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'tablet_device_token_invalid';
    END IF;
    -- Registering again (a lost reply, a reinstall) keeps the FIELD ID.
    UPDATE mc_tablets SET password_hash = p_password_hash, token_hash = p_token_hash,
      serial_number = p_serial_number, platform = p_platform, app_version = p_app_version,
      failed_attempts = 0, locked_until = NULL, updated_at = now()
    WHERE device_id = v_device_id
    RETURNING field_id INTO v_field_id;
    IF FOUND THEN
      RETURN v_field_id;
    END IF;
  END IF;

  LOOP
    -- 9 digits from a random uuid, never starting with 0.
    v_field_id := (100000000 + (('x' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))::bit(32)::bigint % 900000000))::varchar;
    INSERT INTO mc_tablets
      (field_id, password_hash, token_hash, serial_number, platform, app_version, tenant_id, device_id)
    VALUES (v_field_id, p_password_hash, p_token_hash, p_serial_number, p_platform, p_app_version,
      v_tenant_id, v_device_id)
    ON CONFLICT (field_id) DO NOTHING;
    IF FOUND THEN
      RETURN v_field_id;
    END IF;
  END LOOP;
END;
$$;

-- What the tablet's own token says about it. The machine columns are NULL
-- while it isn't on one.
CREATE OR REPLACE FUNCTION mc_tablet_for_token(p_token_hash varchar)
RETURNS TABLE (tablet_id uuid, field_id varchar, device_id uuid, tenant_id uuid,
               machine_id uuid, machine_label varchar)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.id, t.field_id, d.id, d.tenant_id, m.id,
    COALESCE(NULLIF(m.asset_number, ''), NULLIF(m.fleet_number, ''), m.serial_number)::varchar
  FROM mc_tablets t
  LEFT JOIN (mc_devices d JOIN machines m ON m.id = d.machine_id AND m.deleted_at IS NULL)
    ON d.id = t.device_id AND d.disabled_at IS NULL AND d.deleted_at IS NULL
  WHERE t.token_hash = p_token_hash;
$$;

-- The installer's password change, only while the tablet isn't on a machine.
CREATE OR REPLACE FUNCTION mc_tablet_change_password(p_token_hash varchar, p_password_hash varchar)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE mc_tablets t SET password_hash = p_password_hash,
    failed_attempts = 0, locked_until = NULL, updated_at = now()
  WHERE t.token_hash = p_token_hash AND t.tenant_id IS NULL AND t.device_id IS NULL;
  RETURN FOUND;
END;
$$;

-- A device token for the machine the tablet is on, replacing earlier ones.
-- No rows while it isn't on a machine.
CREATE OR REPLACE FUNCTION mc_tablet_open_session(p_token_hash varchar, p_device_token_hash varchar)
RETURNS TABLE (device_id uuid, machine_id uuid, machine_label varchar)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t record;
BEGIN
  PERFORM 1 FROM mc_tablets mt WHERE mt.token_hash = p_token_hash FOR UPDATE;
  SELECT * INTO t FROM mc_tablet_for_token(p_token_hash);
  IF NOT FOUND OR t.device_id IS NULL THEN
    RETURN;
  END IF;
  UPDATE mc_device_credentials cr SET revoked_at = now()
  WHERE cr.device_id = t.device_id AND (cr.revoked_at IS NULL OR cr.revoked_at > now());
  INSERT INTO mc_device_credentials (tenant_id, device_id, token_hash)
  VALUES (t.tenant_id, t.device_id, p_device_token_hash);
  RETURN QUERY SELECT t.device_id, t.machine_id, t.machine_label;
END;
$$;

-- Counts one password attempt before it is checked, so parallel guesses can't
-- beat the limit, and returns the hash to check it against. No rows when
-- there's no such tablet or it belongs to another organisation (the caller
-- can't tell which). p_machine_id: the machine being added to or connected,
-- if known. Error: tablet_locked.
CREATE OR REPLACE FUNCTION mc_tablet_password_attempt(p_field_id varchar, p_machine_id uuid)
RETURNS TABLE (tablet_id uuid, password_hash varchar, machine_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t mc_tablets%ROWTYPE;
  v_machine_id uuid;
  v_attempts integer;
BEGIN
  IF current_app_user_id() IS NULL OR current_tenant_id() IS NULL THEN
    RAISE EXCEPTION 'no person in this request' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT * INTO t FROM mc_tablets mt WHERE mt.field_id = p_field_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  SELECT d.machine_id INTO v_machine_id FROM mc_devices d
  WHERE d.id = t.device_id AND d.disabled_at IS NULL AND d.deleted_at IS NULL;
  IF t.tenant_id IS NOT NULL
     AND t.tenant_id IS DISTINCT FROM current_tenant_id()
     AND t.tenant_id IS DISTINCT FROM mc_connectable_machine_tenant(p_machine_id)
     AND mc_connectable_machine_tenant(v_machine_id) IS NULL THEN
    RETURN;
  END IF;
  IF t.locked_until > now() THEN
    RAISE EXCEPTION 'tablet_locked';
  END IF;
  v_attempts := CASE WHEN t.locked_until IS NULL THEN t.failed_attempts ELSE 0 END + 1;
  UPDATE mc_tablets mt SET failed_attempts = v_attempts,
    locked_until = CASE WHEN v_attempts >= 5 THEN now() + interval '15 minutes' END
  WHERE mt.id = t.id;
  RETURN QUERY SELECT t.id, t.password_hash, v_machine_id;
END;
$$;

CREATE OR REPLACE FUNCTION mc_tablet_password_accepted(p_tablet_id uuid)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE mc_tablets SET failed_attempts = 0, locked_until = NULL WHERE id = p_tablet_id;
$$;

-- Puts a tablet on a machine. The caller has checked its password and the
-- person's permission. Errors: tablet_not_found, tablet_assigned,
-- machine_has_tablet.
CREATE OR REPLACE FUNCTION mc_tablet_assign(p_tablet_id uuid, p_machine_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tenant_id uuid := mc_connectable_machine_tenant(p_machine_id);
  t mc_tablets%ROWTYPE;
  v_current mc_devices%ROWTYPE;
  v_device_id uuid;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'machine not connectable' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT * INTO t FROM mc_tablets WHERE id = p_tablet_id FOR UPDATE;
  IF NOT FOUND OR (t.tenant_id IS NOT NULL AND t.tenant_id <> v_tenant_id) THEN
    RAISE EXCEPTION 'tablet_not_found';
  END IF;
  SELECT * INTO v_current FROM mc_devices
  WHERE id = t.device_id AND disabled_at IS NULL AND deleted_at IS NULL;
  IF FOUND THEN
    IF v_current.machine_id = p_machine_id THEN
      RETURN v_current.id;
    END IF;
    RAISE EXCEPTION 'tablet_assigned';
  END IF;
  IF EXISTS (SELECT 1 FROM mc_devices
             WHERE machine_id = p_machine_id AND disabled_at IS NULL AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'machine_has_tablet';
  END IF;

  UPDATE mc_pairing_codes SET revoked_at = now()
  WHERE machine_id = p_machine_id AND used_at IS NULL AND revoked_at IS NULL;
  INSERT INTO mc_devices (tenant_id, machine_id, serial_number, platform, app_version)
  VALUES (v_tenant_id, p_machine_id, t.serial_number, t.platform, t.app_version)
  RETURNING id INTO v_device_id;
  UPDATE mc_tablets SET tenant_id = v_tenant_id, device_id = v_device_id, updated_at = now()
  WHERE id = p_tablet_id;
  INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, metadata)
  VALUES (v_tenant_id, current_app_user_id(), 'create', 'mc_device', v_device_id,
    jsonb_build_object('machineId', p_machine_id, 'fieldId', t.field_id,
      'serialNumber', t.serial_number, 'platform', t.platform));
  RETURN v_device_id;
END;
$$;

-- A new password for the tablet on a machine, set from the Portal. False
-- when the machine has no registered tablet.
CREATE OR REPLACE FUNCTION mc_tablet_reset_password(p_machine_id uuid, p_password_hash varchar)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tenant_id uuid := mc_connectable_machine_tenant(p_machine_id);
  v_device_id uuid;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'machine not connectable' USING ERRCODE = 'insufficient_privilege';
  END IF;
  UPDATE mc_tablets t SET password_hash = p_password_hash,
    failed_attempts = 0, locked_until = NULL, updated_at = now()
  FROM mc_devices d
  WHERE d.id = t.device_id AND d.machine_id = p_machine_id
    AND d.disabled_at IS NULL AND d.deleted_at IS NULL
  RETURNING d.id INTO v_device_id;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, metadata)
  VALUES (v_tenant_id, current_app_user_id(), 'update', 'mc_device', v_device_id,
    jsonb_build_object('machineId', p_machine_id, 'passwordChanged', true));
  RETURN true;
END;
$$;

-- A connected device's FIELD ID; NULL for one paired with a code.
CREATE OR REPLACE FUNCTION mc_tablet_field_id(p_device_id uuid)
RETURNS varchar
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT field_id FROM mc_tablets WHERE device_id = p_device_id;
$$;

ALTER TABLE mc_remote_sessions
  ADD COLUMN IF NOT EXISTS access_mode varchar NOT NULL DEFAULT 'prompt'
    CHECK (access_mode IN ('prompt', 'unattended'));

-- As 0139, plus the access mode.
CREATE OR REPLACE FUNCTION mc_remote_payload(p_event varchar, s mc_remote_sessions)
RETURNS jsonb
LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object(
    'event', p_event,
    'sessionId', s.id,
    'deviceId', s.device_id,
    'machineId', s.machine_id,
    'status', s.status,
    'access', s.access_mode,
    'reason', s.end_reason,
    'requester', jsonb_build_object('name', s.requester_name),
    'expiresAt', s.expires_at,
    'startedAt', s.started_at,
    'endedAt', s.ended_at,
    'scope', jsonb_build_object(
      'view', true,
      'control', CASE WHEN s.status = 'requested' THEN s.control_requested ELSE s.control_granted END,
      'record', s.record),
    'recording', s.recording_status);
$$;

-- A session to a registered tablet: running at once, nothing to answer. The
-- caller has checked machine access, permission and the tablet's password.
-- Errors: remote_tablet_not_paired, remote_session_busy.
CREATE OR REPLACE FUNCTION mc_remote_start_unattended(
  p_machine_id uuid, p_control boolean, p_viewer_client_id varchar)
RETURNS mc_remote_sessions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := current_app_user_id();
  v_tenant uuid := current_tenant_id();
  v_device mc_devices%ROWTYPE;
  v_name text;
  v_stale uuid;
  v_id uuid := gen_random_uuid();
  s mc_remote_sessions%ROWTYPE;
BEGIN
  IF v_user IS NULL OR v_tenant IS NULL THEN
    RAISE EXCEPTION 'no person in this request' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT d.* INTO v_device FROM mc_devices d
  JOIN mc_tablets t ON t.device_id = d.id
  WHERE d.machine_id = p_machine_id AND d.disabled_at IS NULL AND d.deleted_at IS NULL
  FOR UPDATE OF d;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'remote_tablet_not_paired';
  END IF;

  FOR v_stale IN SELECT id FROM mc_remote_sessions
    WHERE device_id = v_device.id AND status = 'requested' AND expires_at <= now()
  LOOP
    PERFORM mc_remote_close(v_stale, 'expired', 'system');
  END LOOP;
  IF EXISTS (SELECT 1 FROM mc_remote_sessions
             WHERE device_id = v_device.id AND status IN ('requested', 'active')) THEN
    RAISE EXCEPTION 'remote_session_busy';
  END IF;

  SELECT COALESCE(NULLIF(trim(concat_ws(' ', first_name, last_name)), ''), email)
  INTO v_name FROM users WHERE id = v_user;

  INSERT INTO mc_remote_sessions
    (id, tenant_id, machine_id, device_id, requester_id, requester_tenant_id, requester_name,
     access_mode, status, control_requested, control_granted, viewer_client_id, channel_name,
     expires_at, decided_at, started_at, viewer_seen_at, tablet_seen_at, last_activity_at)
  VALUES (v_id, v_device.tenant_id, p_machine_id, v_device.id, v_user, v_tenant,
     COALESCE(v_name, 'FIELD Portal user'), 'unattended', 'active', p_control, p_control,
     p_viewer_client_id, 'field-remote-' || v_id, now(), now(), now(), now(), now(), now())
  RETURNING * INTO s;

  INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, metadata)
  VALUES (s.tenant_id, v_user, 'create', 'mc_remote_session', s.id,
    jsonb_build_object('machineId', p_machine_id, 'control', p_control,
      'access', 'unattended', 'requesterTenantId', v_tenant));

  PERFORM mc_remote_announce('remote:accepted', s);
  RETURN s;
END;
$$;

REVOKE ALL ON FUNCTION mc_tablet_register(varchar, varchar, varchar, varchar, varchar, varchar) FROM PUBLIC;
REVOKE ALL ON FUNCTION mc_tablet_for_token(varchar) FROM PUBLIC;
REVOKE ALL ON FUNCTION mc_tablet_change_password(varchar, varchar) FROM PUBLIC;
REVOKE ALL ON FUNCTION mc_tablet_open_session(varchar, varchar) FROM PUBLIC;
REVOKE ALL ON FUNCTION mc_tablet_password_attempt(varchar, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION mc_tablet_password_accepted(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION mc_tablet_assign(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION mc_tablet_reset_password(uuid, varchar) FROM PUBLIC;
REVOKE ALL ON FUNCTION mc_tablet_field_id(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION mc_remote_start_unattended(uuid, boolean, varchar) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mc_tablet_register(varchar, varchar, varchar, varchar, varchar, varchar) TO field_app;
GRANT EXECUTE ON FUNCTION mc_tablet_for_token(varchar) TO field_app;
GRANT EXECUTE ON FUNCTION mc_tablet_change_password(varchar, varchar) TO field_app;
GRANT EXECUTE ON FUNCTION mc_tablet_open_session(varchar, varchar) TO field_app;
GRANT EXECUTE ON FUNCTION mc_tablet_password_attempt(varchar, uuid) TO field_app;
GRANT EXECUTE ON FUNCTION mc_tablet_password_accepted(uuid) TO field_app;
GRANT EXECUTE ON FUNCTION mc_tablet_assign(uuid, uuid) TO field_app;
GRANT EXECUTE ON FUNCTION mc_tablet_reset_password(uuid, varchar) TO field_app;
GRANT EXECUTE ON FUNCTION mc_tablet_field_id(uuid) TO field_app;
GRANT EXECUTE ON FUNCTION mc_remote_start_unattended(uuid, boolean, varchar) TO field_app;

INSERT INTO schema_migrations (version)
VALUES ('0143_mc_tablet_access')
ON CONFLICT (version) DO NOTHING;
