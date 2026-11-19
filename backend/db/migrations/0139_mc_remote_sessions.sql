-- Machine Control, remote support: a Portal person asks to see (and control)
-- a paired machine tablet; the operator Allows or Declines on the tablet.
--   * One open session (requested or active) per tablet. A request expires
--     after its expires_at if nobody answers.
--   * Allow starts the session: the tablet streams its screen over a Kinesis
--     Video Streams WebRTC signaling channel made for that session alone; the
--     backend presigns each side's connection, so neither side holds AWS
--     credentials. The channel is deleted when the session closes.
--   * Either side ends it; it also ends after 10 minutes without interaction,
--     when either side stops sending heartbeats, or when the tablet unpairs.
--   * Sessions are recorded (the Portal viewer uploads the recording). A
--     session that ran adds a 'remote_session' entry to the machine's history
--     and a metered remote.session usage event (billing section 7).
--   * Every change goes out on 'mc_device_event' (migration 0128) as
--     remote:requested / remote:accepted / remote:declined / remote:ended /
--     remote:recording, to the machine's Portal watchers and the tablet.
-- Rows belong to the machine's owning organisation. Nothing writes the table
-- directly: the SECURITY DEFINER functions below do every change.

CREATE TABLE IF NOT EXISTS mc_remote_sessions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            uuid NOT NULL REFERENCES tenants(id),
  machine_id           uuid NOT NULL REFERENCES machines(id),
  device_id            uuid NOT NULL REFERENCES mc_devices(id),
  requester_id         uuid REFERENCES users(id) ON DELETE SET NULL,
  requester_tenant_id  uuid NOT NULL REFERENCES tenants(id),
  requester_name       text NOT NULL,
  status               varchar NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'active', 'declined', 'expired', 'cancelled', 'ended')),
  control_requested    boolean NOT NULL DEFAULT true,
  control_granted      boolean NOT NULL DEFAULT false,
  record               boolean NOT NULL DEFAULT true,
  -- The only viewer the tablet answers on the signaling channel.
  viewer_client_id     varchar NOT NULL,
  channel_name         varchar,
  channel_arn          varchar,
  channel_deleted_at   timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  expires_at           timestamptz NOT NULL,
  decided_at           timestamptz,
  started_at           timestamptz,
  ended_at             timestamptz,
  end_reason           varchar,
  ended_by             varchar CHECK (ended_by IN ('portal', 'tablet', 'system')),
  viewer_seen_at       timestamptz,
  tablet_seen_at       timestamptz,
  last_activity_at     timestamptz,
  recording_status     varchar NOT NULL DEFAULT 'pending'
    CHECK (recording_status IN ('pending', 'recording', 'completed', 'failed', 'none')),
  recording_key        varchar,
  recording_upload_id  varchar,
  recording_parts      jsonb NOT NULL DEFAULT '[]'::jsonb,
  recording_bytes      bigint NOT NULL DEFAULT 0,
  recording_error      text,
  transcript_status    varchar NOT NULL DEFAULT 'none'
    CHECK (transcript_status IN ('none', 'processing', 'completed', 'failed')),
  transcript_job       varchar,
  transcript_text      text,
  transcript_error     text,
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- One open session per tablet: a second Connect while one is open is refused.
CREATE UNIQUE INDEX IF NOT EXISTS uq_mc_remote_sessions_open_device
  ON mc_remote_sessions (device_id) WHERE status IN ('requested', 'active');
CREATE INDEX IF NOT EXISTS idx_mc_remote_sessions_machine
  ON mc_remote_sessions (machine_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mc_remote_sessions_open
  ON mc_remote_sessions (status) WHERE status IN ('requested', 'active');

ALTER TABLE mc_remote_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mc_remote_sessions FORCE ROW LEVEL SECURITY;

-- Read: the owning organisation, the requester's organisation, and anyone the
-- machine is shared with (like its history).
DROP POLICY IF EXISTS mc_remote_sessions_select ON mc_remote_sessions;
CREATE POLICY mc_remote_sessions_select ON mc_remote_sessions FOR SELECT
  USING (tenant_id = current_tenant_id()
    OR requester_tenant_id = current_tenant_id()
    OR machine_id IN (SELECT machine_id FROM shared_machine_access()));

GRANT SELECT ON mc_remote_sessions TO field_app;

-- The history entry a session that ran leaves on its machine.
ALTER TABLE technical_history_entries
  ADD COLUMN IF NOT EXISTS remote_session_id uuid REFERENCES mc_remote_sessions(id);
ALTER TABLE technical_history_entries DROP CONSTRAINT IF EXISTS technical_history_entries_entry_type_check;
ALTER TABLE technical_history_entries ADD CONSTRAINT technical_history_entries_entry_type_check
  CHECK (entry_type IN ('service', 'repair', 'inspection', 'note', 'fault', 'remote_session'));
CREATE UNIQUE INDEX IF NOT EXISTS uq_technical_history_entries_remote_session
  ON technical_history_entries (remote_session_id) WHERE remote_session_id IS NOT NULL;

-- What both sides are told about a session.
CREATE OR REPLACE FUNCTION mc_remote_payload(p_event varchar, s mc_remote_sessions)
RETURNS jsonb
LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object(
    'event', p_event,
    'sessionId', s.id,
    'deviceId', s.device_id,
    'machineId', s.machine_id,
    'status', s.status,
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

CREATE OR REPLACE FUNCTION mc_remote_announce(p_event varchar, s mc_remote_sessions)
RETURNS void
LANGUAGE sql AS $$
  SELECT mc_announce(mc_remote_payload(p_event, s));
$$;

-- Closes one session (internal). A request that was never answered becomes
-- expired, cancelled (the Portal) or declined (the tablet); a running session
-- becomes ended and leaves its history entry and usage event. Closing a
-- closed session changes nothing.
CREATE OR REPLACE FUNCTION mc_remote_close(p_session_id uuid, p_reason varchar, p_by varchar)
RETURNS mc_remote_sessions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s mc_remote_sessions%ROWTYPE;
  v_seconds bigint;
  v_entry_id uuid;
BEGIN
  SELECT * INTO s FROM mc_remote_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND OR s.status NOT IN ('requested', 'active') THEN
    RETURN s;
  END IF;

  IF s.status = 'requested' THEN
    UPDATE mc_remote_sessions SET
      status = CASE WHEN p_reason = 'expired' THEN 'expired'
                    WHEN p_by = 'tablet' THEN 'declined' ELSE 'cancelled' END,
      ended_at = now(), end_reason = p_reason, ended_by = p_by,
      recording_status = 'none', updated_at = now()
    WHERE id = p_session_id RETURNING * INTO s;
    PERFORM mc_remote_announce(
      CASE WHEN s.status = 'declined' THEN 'remote:declined' ELSE 'remote:ended' END, s);
    RETURN s;
  END IF;

  UPDATE mc_remote_sessions SET
    status = 'ended', ended_at = now(), end_reason = p_reason, ended_by = p_by,
    updated_at = now()
  WHERE id = p_session_id RETURNING * INTO s;
  v_seconds := GREATEST(0, floor(extract(epoch FROM s.ended_at - s.started_at)))::bigint;

  IF s.requester_id IS NOT NULL THEN
    INSERT INTO technical_history_entries
      (tenant_id, machine_id, entry_type, description, created_by, remote_session_id)
    VALUES (s.tenant_id, s.machine_id, 'remote_session',
      format('Remote session by %s (%s min %s s)', s.requester_name,
        v_seconds / 60, v_seconds % 60),
      s.requester_id, s.id)
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_entry_id;
  END IF;

  -- Billed to the machine's organisation from the duration (billing
  -- section 7); a retry can't meter it twice.
  PERFORM app.record_metered_event(s.tenant_id, s.requester_id, 'remote.session',
    v_seconds, 'second', s.id,
    jsonb_build_object('machineId', s.machine_id, 'deviceId', s.device_id,
      'startedAt', s.started_at, 'endedAt', s.ended_at, 'reason', p_reason,
      'requesterTenantId', s.requester_tenant_id),
    'remote.session:' || s.id);

  INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, metadata)
  VALUES (s.tenant_id, current_app_user_id(), 'update', 'mc_remote_session', s.id,
    jsonb_build_object('machineId', s.machine_id, 'status', 'ended',
      'reason', p_reason, 'by', p_by, 'durationSeconds', v_seconds));

  PERFORM mc_remote_announce('remote:ended', s);
  RETURN s;
END;
$$;
REVOKE ALL ON FUNCTION mc_remote_close(uuid, varchar, varchar) FROM PUBLIC;

-- A Portal person asks for a session on a machine's paired tablet. The caller
-- has checked machine access and permissions. Errors (message):
-- remote_tablet_not_paired, remote_session_busy.
CREATE OR REPLACE FUNCTION mc_remote_request(
  p_machine_id uuid, p_control boolean, p_viewer_client_id varchar, p_request_seconds integer)
RETURNS mc_remote_sessions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := current_app_user_id();
  v_tenant uuid := current_tenant_id();
  v_device mc_devices%ROWTYPE;
  v_name text;
  v_stale uuid;
  s mc_remote_sessions%ROWTYPE;
BEGIN
  IF v_user IS NULL OR v_tenant IS NULL THEN
    RAISE EXCEPTION 'no person in this request' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT * INTO v_device FROM mc_devices
  WHERE machine_id = p_machine_id AND disabled_at IS NULL AND deleted_at IS NULL
  FOR UPDATE;
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
    (tenant_id, machine_id, device_id, requester_id, requester_tenant_id, requester_name,
     control_requested, viewer_client_id, expires_at)
  VALUES (v_device.tenant_id, p_machine_id, v_device.id, v_user, v_tenant,
     COALESCE(v_name, 'FIELD Portal user'), p_control, p_viewer_client_id,
     now() + make_interval(secs => p_request_seconds))
  RETURNING * INTO s;

  INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, metadata)
  VALUES (s.tenant_id, v_user, 'create', 'mc_remote_session', s.id,
    jsonb_build_object('machineId', p_machine_id, 'control', p_control,
      'requesterTenantId', v_tenant));

  PERFORM mc_remote_announce('remote:requested', s);
  RETURN s;
END;
$$;
REVOKE ALL ON FUNCTION mc_remote_request(uuid, boolean, varchar, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mc_remote_request(uuid, boolean, varchar, integer) TO field_app;

-- The operator's answer, from the tablet. The same answer again returns the
-- session unchanged (a retried request). Errors (message):
-- remote_session_not_found, remote_session_expired, remote_session_closed.
CREATE OR REPLACE FUNCTION mc_remote_decide(
  p_device_id uuid, p_session_id uuid, p_allow boolean, p_control boolean)
RETURNS mc_remote_sessions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s mc_remote_sessions%ROWTYPE;
BEGIN
  SELECT * INTO s FROM mc_remote_sessions
  WHERE id = p_session_id AND device_id = p_device_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'remote_session_not_found';
  END IF;
  IF (p_allow AND s.status = 'active') OR (NOT p_allow AND s.status = 'declined') THEN
    RETURN s;
  END IF;
  IF s.status = 'expired' OR (s.status = 'requested' AND s.expires_at <= now()) THEN
    RAISE EXCEPTION 'remote_session_expired';
  END IF;
  IF s.status <> 'requested' THEN
    RAISE EXCEPTION 'remote_session_closed';
  END IF;

  IF p_allow THEN
    UPDATE mc_remote_sessions SET
      status = 'active', decided_at = now(), started_at = now(),
      control_granted = s.control_requested AND COALESCE(p_control, true),
      channel_name = 'field-remote-' || s.id,
      viewer_seen_at = now(), tablet_seen_at = now(), last_activity_at = now(),
      recording_status = CASE WHEN s.record THEN 'pending' ELSE 'none' END,
      updated_at = now()
    WHERE id = p_session_id RETURNING * INTO s;
    INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, metadata)
    VALUES (s.tenant_id, NULL, 'update', 'mc_remote_session', s.id,
      jsonb_build_object('machineId', s.machine_id, 'status', 'active',
        'control', s.control_granted));
    PERFORM mc_remote_announce('remote:accepted', s);
    RETURN s;
  END IF;

  INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, metadata)
  VALUES (s.tenant_id, NULL, 'update', 'mc_remote_session', s.id,
    jsonb_build_object('machineId', s.machine_id, 'status', 'declined'));
  RETURN mc_remote_close(p_session_id, 'declined', 'tablet');
END;
$$;
REVOKE ALL ON FUNCTION mc_remote_decide(uuid, uuid, boolean, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mc_remote_decide(uuid, uuid, boolean, boolean) TO field_app;

-- Either side ends (or the Portal cancels) a session. p_device_id is the
-- tablet's own id when the tablet ends it; the Portal caller has checked
-- access. Ending a closed session returns it unchanged.
CREATE OR REPLACE FUNCTION mc_remote_end(
  p_session_id uuid, p_reason varchar, p_by varchar, p_device_id uuid)
RETURNS mc_remote_sessions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s mc_remote_sessions%ROWTYPE;
BEGIN
  SELECT * INTO s FROM mc_remote_sessions
  WHERE id = p_session_id AND (p_device_id IS NULL OR device_id = p_device_id);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'remote_session_not_found';
  END IF;
  RETURN mc_remote_close(p_session_id, p_reason, p_by);
END;
$$;
REVOKE ALL ON FUNCTION mc_remote_end(uuid, varchar, varchar, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mc_remote_end(uuid, varchar, varchar, uuid) TO field_app;

-- A side's heartbeat: it is still there, and whether a person interacted
-- (viewer input sent, or local touch/keyboard on the tablet) since the last.
CREATE OR REPLACE FUNCTION mc_remote_touch(
  p_session_id uuid, p_side varchar, p_interacted boolean, p_device_id uuid)
RETURNS mc_remote_sessions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s mc_remote_sessions%ROWTYPE;
BEGIN
  UPDATE mc_remote_sessions SET
    viewer_seen_at = CASE WHEN p_side = 'viewer' THEN now() ELSE viewer_seen_at END,
    tablet_seen_at = CASE WHEN p_side = 'tablet' THEN now() ELSE tablet_seen_at END,
    last_activity_at = CASE WHEN p_interacted THEN now() ELSE last_activity_at END
  WHERE id = p_session_id AND status = 'active'
    AND (p_device_id IS NULL OR device_id = p_device_id)
  RETURNING * INTO s;
  IF NOT FOUND THEN
    SELECT * INTO s FROM mc_remote_sessions
    WHERE id = p_session_id AND (p_device_id IS NULL OR device_id = p_device_id);
    IF NOT FOUND THEN
      RAISE EXCEPTION 'remote_session_not_found';
    END IF;
  END IF;
  RETURN s;
END;
$$;
REVOKE ALL ON FUNCTION mc_remote_touch(uuid, varchar, boolean, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mc_remote_touch(uuid, varchar, boolean, uuid) TO field_app;

-- Closes what nobody closed: unanswered requests, sessions without
-- interaction for p_inactive_minutes, sessions a side stopped heartbeating
-- for p_lost_seconds, and sessions past p_max_minutes. Returns how many.
CREATE OR REPLACE FUNCTION mc_remote_sweep(
  p_inactive_minutes integer, p_lost_seconds integer, p_max_minutes integer)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record;
  v_count integer := 0;
BEGIN
  FOR r IN
    SELECT id,
      CASE
        WHEN status = 'requested' THEN 'expired'
        WHEN started_at <= now() - make_interval(mins => p_max_minutes) THEN 'max_duration'
        WHEN last_activity_at <= now() - make_interval(mins => p_inactive_minutes) THEN 'inactive'
        WHEN viewer_seen_at <= now() - make_interval(secs => p_lost_seconds) THEN 'viewer_lost'
        WHEN tablet_seen_at <= now() - make_interval(secs => p_lost_seconds) THEN 'tablet_lost'
      END AS reason
    FROM mc_remote_sessions
    WHERE (status = 'requested' AND expires_at <= now())
       OR (status = 'active' AND (
            started_at <= now() - make_interval(mins => p_max_minutes)
         OR last_activity_at <= now() - make_interval(mins => p_inactive_minutes)
         OR viewer_seen_at <= now() - make_interval(secs => p_lost_seconds)
         OR tablet_seen_at <= now() - make_interval(secs => p_lost_seconds)))
  LOOP
    PERFORM mc_remote_close(r.id, r.reason, 'system');
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION mc_remote_sweep(integer, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mc_remote_sweep(integer, integer, integer) TO field_app;

-- Losing the pairing (either side disconnects, a new tablet replaces it, the
-- machine goes) closes the tablet's open session at once.
CREATE OR REPLACE FUNCTION mc_devices_close_remote_sessions()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
BEGIN
  IF OLD.disabled_at IS NULL AND NEW.disabled_at IS NOT NULL THEN
    FOR v_id IN SELECT id FROM mc_remote_sessions
      WHERE device_id = NEW.id AND status IN ('requested', 'active')
    LOOP
      PERFORM mc_remote_close(v_id, 'unpaired', 'system');
    END LOOP;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_mc_devices_close_remote_sessions ON mc_devices;
CREATE TRIGGER trg_mc_devices_close_remote_sessions
  AFTER UPDATE OF disabled_at ON mc_devices
  FOR EACH ROW EXECUTE FUNCTION mc_devices_close_remote_sessions();

-- The session's signaling channel was created.
CREATE OR REPLACE FUNCTION mc_remote_set_channel(p_session_id uuid, p_channel_arn varchar)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE mc_remote_sessions SET channel_arn = p_channel_arn, updated_at = now()
  WHERE id = p_session_id AND channel_arn IS DISTINCT FROM p_channel_arn;
$$;
REVOKE ALL ON FUNCTION mc_remote_set_channel(uuid, varchar) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mc_remote_set_channel(uuid, varchar) TO field_app;

CREATE OR REPLACE FUNCTION mc_remote_channel_deleted(p_session_id uuid)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE mc_remote_sessions SET channel_deleted_at = now(), updated_at = now()
  WHERE id = p_session_id AND channel_deleted_at IS NULL;
$$;
REVOKE ALL ON FUNCTION mc_remote_channel_deleted(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mc_remote_channel_deleted(uuid) TO field_app;

-- Recording: the viewer's upload began (returns the session; an upload
-- already under way is kept).
CREATE OR REPLACE FUNCTION mc_remote_recording_start(
  p_session_id uuid, p_key varchar, p_upload_id varchar)
RETURNS mc_remote_sessions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s mc_remote_sessions%ROWTYPE;
BEGIN
  UPDATE mc_remote_sessions SET recording_status = 'recording',
    recording_key = p_key, recording_upload_id = p_upload_id, updated_at = now()
  WHERE id = p_session_id AND status = 'active' AND recording_status = 'pending'
  RETURNING * INTO s;
  IF FOUND THEN
    PERFORM mc_remote_announce('remote:recording', s);
    RETURN s;
  END IF;
  SELECT * INTO s FROM mc_remote_sessions WHERE id = p_session_id;
  RETURN s;
END;
$$;
REVOKE ALL ON FUNCTION mc_remote_recording_start(uuid, varchar, varchar) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mc_remote_recording_start(uuid, varchar, varchar) TO field_app;

-- One uploaded part (a retried part number replaces the earlier one).
CREATE OR REPLACE FUNCTION mc_remote_recording_part(
  p_session_id uuid, p_part integer, p_etag varchar, p_bytes bigint)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE mc_remote_sessions SET
    recording_parts = COALESCE((
      SELECT jsonb_agg(p ORDER BY (p->>'part')::int)
      FROM jsonb_array_elements(recording_parts) p
      WHERE (p->>'part')::int <> p_part), '[]'::jsonb)
      || jsonb_build_array(jsonb_build_object('part', p_part, 'etag', p_etag, 'bytes', p_bytes)),
    updated_at = now()
  WHERE id = p_session_id AND recording_status = 'recording';
  UPDATE mc_remote_sessions SET recording_bytes = (
      SELECT COALESCE(sum((p->>'bytes')::bigint), 0) FROM jsonb_array_elements(recording_parts) p)
  WHERE id = p_session_id;
$$;
REVOKE ALL ON FUNCTION mc_remote_recording_part(uuid, integer, varchar, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mc_remote_recording_part(uuid, integer, varchar, bigint) TO field_app;

-- The recording finished (completed) or couldn't be kept (failed); a
-- completed one may start transcription (p_transcript_job).
CREATE OR REPLACE FUNCTION mc_remote_recording_finish(
  p_session_id uuid, p_status varchar, p_error text, p_transcript_job varchar)
RETURNS mc_remote_sessions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s mc_remote_sessions%ROWTYPE;
BEGIN
  IF p_status NOT IN ('completed', 'failed') THEN
    RAISE EXCEPTION 'bad recording status %', p_status USING ERRCODE = 'check_violation';
  END IF;
  UPDATE mc_remote_sessions SET
    recording_status = p_status,
    recording_error = CASE WHEN p_status = 'failed' THEN p_error END,
    recording_upload_id = NULL,
    transcript_status = CASE WHEN p_transcript_job IS NOT NULL THEN 'processing' ELSE transcript_status END,
    transcript_job = COALESCE(p_transcript_job, transcript_job),
    updated_at = now()
  WHERE id = p_session_id AND recording_status IN ('pending', 'recording')
  RETURNING * INTO s;
  IF FOUND THEN
    PERFORM mc_remote_announce('remote:recording', s);
    RETURN s;
  END IF;
  SELECT * INTO s FROM mc_remote_sessions WHERE id = p_session_id;
  RETURN s;
END;
$$;
REVOKE ALL ON FUNCTION mc_remote_recording_finish(uuid, varchar, text, varchar) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mc_remote_recording_finish(uuid, varchar, text, varchar) TO field_app;

CREATE OR REPLACE FUNCTION mc_remote_transcript_finish(
  p_session_id uuid, p_status varchar, p_text text, p_error text)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE mc_remote_sessions SET
    transcript_status = p_status,
    transcript_text = CASE WHEN p_status = 'completed' THEN p_text END,
    transcript_error = CASE WHEN p_status = 'failed' THEN p_error END,
    updated_at = now()
  WHERE id = p_session_id AND transcript_status = 'processing'
    AND p_status IN ('completed', 'failed');
$$;
REVOKE ALL ON FUNCTION mc_remote_transcript_finish(uuid, varchar, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mc_remote_transcript_finish(uuid, varchar, text, text) TO field_app;

-- Background work across organisations: channels to delete, recordings the
-- viewer never finished (closed more than p_grace_seconds ago), and
-- transcripts still processing.
CREATE OR REPLACE FUNCTION mc_remote_pending_work(p_grace_seconds integer)
RETURNS SETOF mc_remote_sessions
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM mc_remote_sessions
  WHERE status NOT IN ('requested', 'active') AND (
       (channel_arn IS NOT NULL AND channel_deleted_at IS NULL)
    OR (recording_status IN ('pending', 'recording')
        AND ended_at <= now() - make_interval(secs => p_grace_seconds))
    OR transcript_status = 'processing')
  ORDER BY ended_at
  LIMIT 50;
$$;
REVOKE ALL ON FUNCTION mc_remote_pending_work(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mc_remote_pending_work(integer) TO field_app;

-- A session by id for the backend's own bookkeeping (recording, channel);
-- callers have checked who is asking.
CREATE OR REPLACE FUNCTION mc_remote_sessions_by_id(p_session_id uuid)
RETURNS SETOF mc_remote_sessions
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM mc_remote_sessions WHERE id = p_session_id;
$$;
REVOKE ALL ON FUNCTION mc_remote_sessions_by_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mc_remote_sessions_by_id(uuid) TO field_app;

-- A session by id for the tablet (no organisation in its requests).
CREATE OR REPLACE FUNCTION mc_remote_for_device(p_device_id uuid, p_session_id uuid)
RETURNS SETOF mc_remote_sessions
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM mc_remote_sessions
  WHERE device_id = p_device_id
    AND (p_session_id IS NOT NULL AND id = p_session_id
      OR p_session_id IS NULL AND status IN ('requested', 'active'))
  ORDER BY created_at DESC
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION mc_remote_for_device(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mc_remote_for_device(uuid, uuid) TO field_app;

INSERT INTO schema_migrations (version)
VALUES ('0139_mc_remote_sessions')
ON CONFLICT (version) DO NOTHING;
