-- A short or mostly still session buffers less than one 5 MiB part while it
-- runs, so the viewer uploads its first (and only) part as the session
-- ends. If the tablet or the sweep ended the session first, 0139's
-- mc_remote_recording_start refused it (status had to be 'active') and the
-- session was left with "No recording". The upload may now also start
-- within the recording grace period after the session ended
-- (REMOTE_RECORDING_GRACE_SECONDS, 120 s; the worker completes or fails
-- recordings only after it).
CREATE OR REPLACE FUNCTION mc_remote_recording_start(
  p_session_id uuid, p_key varchar, p_upload_id varchar)
RETURNS mc_remote_sessions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s mc_remote_sessions%ROWTYPE;
BEGIN
  UPDATE mc_remote_sessions SET recording_status = 'recording',
    recording_key = p_key, recording_upload_id = p_upload_id, updated_at = now()
  WHERE id = p_session_id AND record AND recording_status = 'pending'
    AND (status = 'active'
      OR (status = 'ended' AND ended_at > now() - interval '120 seconds'))
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

INSERT INTO schema_migrations (version)
VALUES ('0141_mc_remote_recording_grace') ON CONFLICT DO NOTHING;
