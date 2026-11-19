-- Tablet-initiated remote support uses the existing session lifecycle.
ALTER TABLE mc_remote_sessions
  ADD COLUMN IF NOT EXISTS initiated_by varchar NOT NULL DEFAULT 'portal'
    CHECK (initiated_by IN ('portal', 'tablet')),
  ADD COLUMN help_claimed_at timestamptz,
  ADD CONSTRAINT mc_remote_help_requires_claim
    CHECK (initiated_by = 'portal' OR status <> 'active' OR help_claimed_at IS NOT NULL);

CREATE OR REPLACE FUNCTION mc_remote_request_help(
  p_device_id uuid, p_request_id uuid, p_control boolean, p_viewer_client_id varchar)
RETURNS mc_remote_sessions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  d mc_devices%ROWTYPE;
  s mc_remote_sessions%ROWTYPE;
  v_stale uuid;
BEGIN
  SELECT * INTO d FROM mc_devices
  WHERE id = p_device_id AND tenant_id = current_tenant_id()
    AND disabled_at IS NULL AND deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'remote_tablet_not_paired';
  END IF;

  SELECT * INTO s FROM mc_remote_sessions WHERE id = p_request_id;
  IF FOUND THEN
    IF s.device_id = d.id AND s.initiated_by = 'tablet'
       AND s.control_requested = p_control THEN
      RETURN s;
    END IF;
    RAISE EXCEPTION 'remote_session_busy';
  END IF;

  SELECT id INTO v_stale FROM mc_remote_sessions
  WHERE device_id = d.id AND status = 'requested' AND expires_at <= now()
  FOR UPDATE;
  IF FOUND THEN
    PERFORM mc_remote_close(v_stale, 'expired', 'system');
  END IF;
  IF EXISTS (SELECT 1 FROM mc_remote_sessions
             WHERE device_id = d.id AND status IN ('requested', 'active')) THEN
    RAISE EXCEPTION 'remote_session_busy';
  END IF;

  INSERT INTO mc_remote_sessions
    (id, tenant_id, machine_id, device_id, requester_tenant_id, requester_name,
     initiated_by, control_requested, viewer_client_id, expires_at)
  VALUES (p_request_id, d.tenant_id, d.machine_id, d.id, d.tenant_id, 'Tablet operator',
          'tablet', p_control, p_viewer_client_id, now() + interval '5 minutes')
  ON CONFLICT (id) DO NOTHING
  RETURNING * INTO s;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'remote_session_busy';
  END IF;

  INSERT INTO audit_logs (tenant_id, action, entity_type, entity_id, metadata)
  VALUES (s.tenant_id, 'create', 'mc_remote_session', s.id,
    jsonb_build_object('machineId', s.machine_id, 'deviceId', s.device_id,
      'initiatedBy', 'tablet', 'control', p_control));
  PERFORM mc_remote_announce('remote:help_requested', s);
  RETURN s;
END;
$$;
REVOKE ALL ON FUNCTION mc_remote_request_help(uuid, uuid, boolean, varchar) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mc_remote_request_help(uuid, uuid, boolean, varchar) TO field_app;

CREATE OR REPLACE FUNCTION mc_remote_claim_help(p_machine_id uuid, p_session_id uuid)
RETURNS mc_remote_sessions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s mc_remote_sessions%ROWTYPE;
  v_user uuid := current_app_user_id();
  v_tenant uuid := current_tenant_id();
  v_name text;
BEGIN
  IF v_user IS NULL OR v_tenant IS NULL THEN
    RAISE EXCEPTION 'no person in this request' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT * INTO s FROM mc_remote_sessions
  WHERE id = p_session_id AND machine_id = p_machine_id AND initiated_by = 'tablet'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'remote_session_not_found';
  END IF;
  IF s.status = 'active' AND s.requester_id = v_user THEN
    RETURN s;
  END IF;
  IF s.status = 'expired' OR (s.status = 'requested' AND s.expires_at <= now()) THEN
    RAISE EXCEPTION 'remote_session_expired';
  END IF;
  IF s.status <> 'requested' THEN
    RAISE EXCEPTION 'remote_session_closed';
  END IF;

  SELECT COALESCE(NULLIF(trim(concat_ws(' ', first_name, last_name)), ''), email)
  INTO v_name FROM users WHERE id = v_user;

  UPDATE mc_remote_sessions SET requester_id = v_user, requester_tenant_id = v_tenant,
    help_claimed_at = now(),
    requester_name = COALESCE(v_name, 'FIELD Portal user')
  WHERE id = s.id;

  -- Reuse the normal activation and event with the operator's original scope.
  RETURN mc_remote_decide(s.device_id, s.id, true, s.control_requested);
END;
$$;
REVOKE ALL ON FUNCTION mc_remote_claim_help(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mc_remote_claim_help(uuid, uuid) TO field_app;

INSERT INTO schema_migrations (version)
VALUES ('0140_mc_remote_help') ON CONFLICT DO NOTHING;
