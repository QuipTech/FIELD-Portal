-- Machine Control, second part: the live session between a paired tablet and
-- the portal. The pairing is the session: it lasts until the portal
-- disconnects it, the tablet removes itself, another tablet pairs, or the
-- tablet stays offline past the timeout.
--   * The tablet signs in to REST and the /machine-app socket with its device
--     token, and swaps that token for a new one now and then (refresh); the
--     old one keeps working for 5 minutes in case the reply never arrived.
--   * Status: 'active' while the tablet's socket and at least one portal
--     viewer are connected, 'pending' while either side is missing.
--   * Each API container stamps last_seen_at on its sockets every 30 seconds;
--     mc_sweep_sessions() clears what a crashed container left behind.
--   * Every change goes out on the 'mc_device_event' channel; each API
--     container forwards it to the sockets it holds. pg_notify waits for
--     COMMIT, so a rolled-back change announces nothing.

ALTER TABLE mc_devices
  ADD COLUMN IF NOT EXISTS online_socket_id varchar,
  ADD COLUMN IF NOT EXISTS online_since timestamptz,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

-- Portal sockets watching a machine. Only reached through the functions below.
CREATE TABLE IF NOT EXISTS mc_portal_watchers (
  socket_id     varchar NOT NULL,
  machine_id    uuid NOT NULL REFERENCES machines(id),
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (socket_id, machine_id)
);
CREATE INDEX IF NOT EXISTS idx_mc_portal_watchers_machine ON mc_portal_watchers (machine_id);
ALTER TABLE mc_portal_watchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE mc_portal_watchers FORCE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION mc_announce(p_payload jsonb)
RETURNS void
LANGUAGE sql AS $$
  SELECT pg_notify('mc_device_event', p_payload::text);
$$;

-- Where the machine's live session stands; no rows when it has none.
CREATE OR REPLACE FUNCTION mc_session_state(p_machine_id uuid)
RETURNS TABLE (device_id uuid, status varchar, tablet_online boolean, portal_online boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT d.id,
    (CASE WHEN d.online_socket_id IS NOT NULL AND w.online THEN 'active' ELSE 'pending' END)::varchar,
    d.online_socket_id IS NOT NULL, w.online
  FROM mc_devices d
  CROSS JOIN LATERAL (SELECT EXISTS (
    SELECT 1 FROM mc_portal_watchers pw WHERE pw.machine_id = d.machine_id) AS online) w
  WHERE d.machine_id = p_machine_id AND d.disabled_at IS NULL AND d.deleted_at IS NULL;
$$;

CREATE OR REPLACE FUNCTION mc_announce_session_status(p_machine_id uuid)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT mc_announce(jsonb_build_object('event', 'session:status',
    'deviceId', s.device_id, 'machineId', p_machine_id, 'reason', NULL,
    'status', s.status, 'tabletOnline', s.tablet_online, 'portalOnline', s.portal_online))
  FROM mc_session_state(p_machine_id) s;
$$;

-- Covers every way a session ends, machine deletion included. A reason set in
-- app.mc_end_reason wins; otherwise a person ending it is the portal, and
-- nobody signed in means a new tablet replaced it.
CREATE OR REPLACE FUNCTION mc_devices_announce_session()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM mc_announce(jsonb_build_object('event', 'session:started',
      'deviceId', NEW.id, 'machineId', NEW.machine_id, 'reason', NULL));
  ELSIF OLD.disabled_at IS NULL AND NEW.disabled_at IS NOT NULL THEN
    PERFORM mc_announce(jsonb_build_object('event', 'session:ended',
      'deviceId', NEW.id, 'machineId', NEW.machine_id, 'reason',
      COALESCE(NULLIF(current_setting('app.mc_end_reason', true), ''),
        CASE WHEN current_app_user_id() IS NULL THEN 'replaced' ELSE 'portal_disconnected' END)));
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_mc_devices_announce_session ON mc_devices;
CREATE TRIGGER trg_mc_devices_announce_session
  AFTER INSERT OR UPDATE OF disabled_at ON mc_devices
  FOR EACH ROW EXECUTE FUNCTION mc_devices_announce_session();

-- The live device a token belongs to; no rows when it's revoked or the
-- tablet is no longer connected.
CREATE OR REPLACE FUNCTION mc_device_for_token(p_token_hash varchar)
RETURNS TABLE (device_id uuid, machine_id uuid, tenant_id uuid, machine_label varchar)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT d.id, d.machine_id, d.tenant_id,
    COALESCE(NULLIF(m.asset_number, ''), NULLIF(m.fleet_number, ''), m.serial_number)::varchar
  FROM mc_device_credentials cr
  JOIN mc_devices d ON d.id = cr.device_id AND d.disabled_at IS NULL AND d.deleted_at IS NULL
  JOIN machines m ON m.id = d.machine_id AND m.deleted_at IS NULL
  WHERE cr.token_hash = p_token_hash
    AND (cr.revoked_at IS NULL OR cr.revoked_at > now());
$$;

-- Swaps a token for a new one. False when the old token isn't live.
CREATE OR REPLACE FUNCTION mc_rotate_device_token(p_old_hash varchar, p_new_hash varchar)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_device record;
BEGIN
  SELECT * INTO v_device FROM mc_device_for_token(p_old_hash);
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  UPDATE mc_device_credentials SET revoked_at = now() + interval '5 minutes'
  WHERE device_id = v_device.device_id AND revoked_at IS NULL;
  INSERT INTO mc_device_credentials (tenant_id, device_id, token_hash)
  VALUES (v_device.tenant_id, v_device.device_id, p_new_hash);
  RETURN true;
END;
$$;

-- Ends one live session with a reason: its tokens stop working at once.
CREATE OR REPLACE FUNCTION mc_end_device(p_device_id uuid, p_reason varchar)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_device mc_devices%ROWTYPE;
BEGIN
  SELECT * INTO v_device FROM mc_devices WHERE id = p_device_id AND disabled_at IS NULL;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  PERFORM set_config('app.mc_end_reason', p_reason, true);
  UPDATE mc_device_credentials SET revoked_at = now()
  WHERE device_id = p_device_id AND (revoked_at IS NULL OR revoked_at > now());
  UPDATE mc_devices SET disabled_at = now(), online_socket_id = NULL, online_since = NULL
  WHERE id = p_device_id;
  INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, metadata)
  VALUES (v_device.tenant_id, NULL, 'delete', 'mc_device', p_device_id,
    jsonb_build_object('machineId', v_device.machine_id, 'reason', p_reason));
  PERFORM set_config('app.mc_end_reason', '', true);
END;
$$;

-- The tablet removes itself. False when the token isn't live.
CREATE OR REPLACE FUNCTION mc_end_device_session(p_token_hash varchar)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_device_id uuid;
BEGIN
  SELECT device_id INTO v_device_id FROM mc_device_for_token(p_token_hash);
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  PERFORM mc_end_device(v_device_id, 'tablet_disconnected');
  RETURN true;
END;
$$;

-- The tablet's socket connected or dropped. Going offline only counts for the
-- socket that is online, so a late drop of an old socket can't hide a
-- reconnect. Nothing happens for an ended session.
CREATE OR REPLACE FUNCTION mc_set_device_online(p_device_id uuid, p_socket_id varchar, p_online boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_machine_id uuid;
BEGIN
  UPDATE mc_devices
  SET online_socket_id = CASE WHEN p_online THEN p_socket_id END,
      online_since = CASE WHEN p_online THEN now() END,
      last_seen_at = now()
  WHERE id = p_device_id AND disabled_at IS NULL AND deleted_at IS NULL
    AND (p_online OR online_socket_id = p_socket_id)
  RETURNING machine_id INTO v_machine_id;
  IF FOUND THEN
    PERFORM mc_announce_session_status(v_machine_id);
  END IF;
END;
$$;

-- A portal socket starts watching a machine. The caller has checked access.
CREATE OR REPLACE FUNCTION mc_watch_machine(p_socket_id varchar, p_machine_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_was_watched boolean := EXISTS (SELECT 1 FROM mc_portal_watchers WHERE machine_id = p_machine_id);
BEGIN
  INSERT INTO mc_portal_watchers (socket_id, machine_id) VALUES (p_socket_id, p_machine_id)
  ON CONFLICT (socket_id, machine_id) DO UPDATE SET last_seen_at = now();
  IF NOT v_was_watched THEN
    PERFORM mc_announce_session_status(p_machine_id);
  END IF;
END;
$$;

-- A portal socket stops watching one machine, or all of them (NULL).
CREATE OR REPLACE FUNCTION mc_unwatch_machine(p_socket_id varchar, p_machine_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_machine_id uuid;
BEGIN
  FOR v_machine_id IN
    DELETE FROM mc_portal_watchers
    WHERE socket_id = p_socket_id AND (p_machine_id IS NULL OR machine_id = p_machine_id)
    RETURNING machine_id
  LOOP
    IF NOT EXISTS (SELECT 1 FROM mc_portal_watchers WHERE machine_id = v_machine_id) THEN
      PERFORM mc_announce_session_status(v_machine_id);
    END IF;
  END LOOP;
END;
$$;

-- A container's heartbeat for the sockets it holds.
CREATE OR REPLACE FUNCTION mc_touch_live(p_device_ids uuid[], p_socket_ids varchar[])
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE mc_devices SET last_seen_at = now()
  WHERE id = ANY (p_device_ids) AND online_socket_id IS NOT NULL;
  UPDATE mc_portal_watchers SET last_seen_at = now() WHERE socket_id = ANY (p_socket_ids);
$$;

-- Clears sockets nobody has vouched for in p_stale_seconds (a container
-- died), and ends sessions whose tablet has been offline p_timeout_minutes.
-- One container at a time. Returns how many sessions ended.
CREATE OR REPLACE FUNCTION mc_sweep_sessions(p_stale_seconds integer, p_timeout_minutes integer)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_machine_id uuid;
  v_device_id uuid;
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
  FOR v_device_id IN
    SELECT id FROM mc_devices
    WHERE disabled_at IS NULL AND deleted_at IS NULL AND online_socket_id IS NULL
      AND COALESCE(last_seen_at, paired_at) < now() - make_interval(mins => p_timeout_minutes)
  LOOP
    PERFORM mc_end_device(v_device_id, 'connection_timeout');
    v_ended := v_ended + 1;
  END LOOP;
  RETURN v_ended;
END;
$$;

REVOKE ALL ON FUNCTION mc_announce(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION mc_session_state(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION mc_announce_session_status(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION mc_device_for_token(varchar) FROM PUBLIC;
REVOKE ALL ON FUNCTION mc_rotate_device_token(varchar, varchar) FROM PUBLIC;
REVOKE ALL ON FUNCTION mc_end_device(uuid, varchar) FROM PUBLIC;
REVOKE ALL ON FUNCTION mc_end_device_session(varchar) FROM PUBLIC;
REVOKE ALL ON FUNCTION mc_set_device_online(uuid, varchar, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION mc_watch_machine(varchar, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION mc_unwatch_machine(varchar, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION mc_touch_live(uuid[], varchar[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION mc_sweep_sessions(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mc_session_state(uuid) TO field_app;
GRANT EXECUTE ON FUNCTION mc_device_for_token(varchar) TO field_app;
GRANT EXECUTE ON FUNCTION mc_rotate_device_token(varchar, varchar) TO field_app;
GRANT EXECUTE ON FUNCTION mc_end_device_session(varchar) TO field_app;
GRANT EXECUTE ON FUNCTION mc_set_device_online(uuid, varchar, boolean) TO field_app;
GRANT EXECUTE ON FUNCTION mc_watch_machine(varchar, uuid) TO field_app;
GRANT EXECUTE ON FUNCTION mc_unwatch_machine(varchar, uuid) TO field_app;
GRANT EXECUTE ON FUNCTION mc_touch_live(uuid[], varchar[]) TO field_app;
GRANT EXECUTE ON FUNCTION mc_sweep_sessions(integer, integer) TO field_app;

INSERT INTO schema_migrations (version)
VALUES ('0128_machine_app_live_session')
ON CONFLICT (version) DO NOTHING;
