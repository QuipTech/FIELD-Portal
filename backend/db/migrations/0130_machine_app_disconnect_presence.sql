-- Separate durable pairing from transport presence. Preserve the deployed
-- REST routes and Socket.IO events. Offline sweeps must never revoke pairing.
-- p_timeout_minutes remains in the signature for rolling-deploy compatibility.
CREATE OR REPLACE FUNCTION mc_end_device_session(p_token_hash varchar)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_device mc_devices%ROWTYPE;
BEGIN
  -- Lock the credential's own device: an old-token retry cannot affect a replacement.
  SELECT d.* INTO v_device FROM mc_devices d
    JOIN mc_device_credentials c ON c.device_id = d.id
    WHERE c.token_hash = p_token_hash FOR UPDATE OF d;
  IF NOT FOUND THEN RETURN false; END IF;
  IF v_device.disabled_at IS NOT NULL THEN RETURN true; END IF;
  -- An expired rotated token must not revoke a currently live pairing.
  IF NOT EXISTS(SELECT 1 FROM mc_device_for_token(p_token_hash)) THEN RETURN false; END IF;
  PERFORM mc_end_device(v_device.id, 'tablet_disconnected');
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION mc_disconnect_machine_app(p_machine_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_device_id uuid; v_found boolean := false;
BEGIN
  IF mc_connectable_machine_tenant(p_machine_id) IS NULL THEN
    RAISE EXCEPTION 'machine not connectable' USING ERRCODE = 'insufficient_privilege';
  END IF;
  UPDATE mc_pairing_codes SET revoked_at = now()
    WHERE machine_id = p_machine_id AND used_at IS NULL AND revoked_at IS NULL;
  FOR v_device_id IN SELECT id FROM mc_devices
    WHERE machine_id = p_machine_id AND disabled_at IS NULL AND deleted_at IS NULL FOR UPDATE
  LOOP
    PERFORM mc_end_device(v_device_id, 'portal_disconnected');
    v_found := true;
  END LOOP;
  RETURN v_found;
END;
$$;

CREATE OR REPLACE FUNCTION mc_touch_live(p_device_ids uuid[], p_socket_ids varchar[])
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE mc_devices SET last_seen_at = now()
  WHERE id = ANY (p_device_ids) AND online_socket_id = ANY (p_socket_ids) AND disabled_at IS NULL;
  UPDATE mc_portal_watchers SET last_seen_at = now() WHERE socket_id = ANY (p_socket_ids);
$$;

CREATE OR REPLACE FUNCTION mc_sweep_sessions(p_stale_seconds integer, p_timeout_minutes integer)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_machine_id uuid;
  v_ended integer := 0;
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtext('mc_sweep_sessions')) THEN
    RETURN 0;
  END IF;
  FOR v_machine_id IN
    WITH gone_watchers AS (
      DELETE FROM mc_portal_watchers
      WHERE last_seen_at < now() - make_interval(secs => p_stale_seconds)
      RETURNING machine_id
    ), gone_tablets AS (
      UPDATE mc_devices SET online_socket_id = NULL, online_since = NULL
      WHERE online_socket_id IS NOT NULL
        AND last_seen_at < now() - make_interval(secs => p_stale_seconds)
      RETURNING machine_id
    )
    SELECT machine_id FROM gone_watchers UNION SELECT machine_id FROM gone_tablets
  LOOP
    PERFORM mc_announce_session_status(v_machine_id);
  END LOOP;
  RETURN v_ended;
END;
$$;

INSERT INTO schema_migrations(version) VALUES('0130_machine_app_disconnect_presence') ON CONFLICT DO NOTHING;
