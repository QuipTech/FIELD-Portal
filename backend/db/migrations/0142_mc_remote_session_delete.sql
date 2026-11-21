-- Deleting remote session recordings and sessions.
--   mc.remote_delete  delete a remote session's recording, or the whole
--                     session from the machine's History
-- Owner and Organisation Admin get it. Only the machine's owning
-- organisation, and only once the session has ended. The backend deletes
-- the files (recording.webm, transcript.json) from storage.

INSERT INTO permissions (code, description) VALUES
  ('mc.remote_delete', 'Delete remote session recordings and sessions')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id, tenant_id)
SELECT r.id, p.id, NULL
FROM roles r
JOIN permissions p ON p.code = 'mc.remote_delete'
WHERE r.name IN ('Owner', 'Organisation Admin')
  AND r.is_system_role AND r.tenant_id IS NULL AND r.deleted_at IS NULL
ON CONFLICT DO NOTHING;

-- Clears a closed session's recording and transcript and returns the
-- session as it was before (so the caller knows which files to delete).
-- No row when the session isn't this organisation's or is still open.
CREATE OR REPLACE FUNCTION mc_remote_recording_delete(p_session_id uuid)
RETURNS SETOF mc_remote_sessions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s mc_remote_sessions%ROWTYPE;
BEGIN
  SELECT * INTO s FROM mc_remote_sessions
  WHERE id = p_session_id AND tenant_id = current_tenant_id()
    AND status NOT IN ('requested', 'active')
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  UPDATE mc_remote_sessions SET
    recording_status = 'none',
    recording_key = NULL,
    recording_upload_id = NULL,
    recording_parts = '[]'::jsonb,
    recording_bytes = 0,
    recording_error = NULL,
    transcript_status = 'none',
    transcript_job = NULL,
    transcript_text = NULL,
    transcript_error = NULL,
    updated_at = now()
  WHERE id = p_session_id;
  RETURN NEXT s;
END;
$$;
REVOKE ALL ON FUNCTION mc_remote_recording_delete(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mc_remote_recording_delete(uuid) TO field_app;

-- Removes a closed session from the machine's History (soft delete of its
-- history entry, kept for audit) after clearing its recording. Returns the
-- session as it was before.
CREATE OR REPLACE FUNCTION mc_remote_session_delete(p_session_id uuid)
RETURNS SETOF mc_remote_sessions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s mc_remote_sessions%ROWTYPE;
BEGIN
  SELECT * INTO s FROM mc_remote_recording_delete(p_session_id);
  IF NOT FOUND THEN
    RETURN;
  END IF;
  UPDATE technical_history_entries SET deleted_at = now(), updated_at = now()
  WHERE remote_session_id = p_session_id AND tenant_id = current_tenant_id()
    AND deleted_at IS NULL;
  RETURN NEXT s;
END;
$$;
REVOKE ALL ON FUNCTION mc_remote_session_delete(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mc_remote_session_delete(uuid) TO field_app;

INSERT INTO schema_migrations (version)
VALUES ('0142_mc_remote_session_delete') ON CONFLICT DO NOTHING;
