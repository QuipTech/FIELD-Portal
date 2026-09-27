-- Section 1f: self-service account deletion. field_app has no DELETE grant
-- (soft delete only, see 0002), so the hard delete lives in one SECURITY
-- DEFINER function that runs the whole cascade atomically.
--
-- What happens to each users(id) reference:
--   * Personal data is deleted: sessions, device registrations, role
--     assignments, AI conversations (and everything hanging off their
--     messages), knowledge feedback, calculator results, favourite tools.
--   * Shared tenant records stay on the tenant's CMDB — machines, history,
--     snapshots, knowledge, support, audit — with the user reference set to
--     NULL, which reads as "deleted user".

-- Authorship columns on shared records must be able to outlive their author.
ALTER TABLE machines ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE component_replacement_records ALTER COLUMN replaced_by DROP NOT NULL;
ALTER TABLE technical_history_entries ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE knowledge_items ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE document_versions ALTER COLUMN uploaded_by DROP NOT NULL;
ALTER TABLE resolution_records ALTER COLUMN authored_by DROP NOT NULL;
ALTER TABLE review_queue_items ALTER COLUMN submitted_by DROP NOT NULL;
ALTER TABLE support_updates ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE support_escalations ALTER COLUMN escalated_by DROP NOT NULL;
ALTER TABLE ai_escalations ALTER COLUMN escalated_by DROP NOT NULL;

-- An approval keeps its timestamp after the approver is deleted, so only
-- "approver without a time" is still invalid.
ALTER TABLE resolution_records
  DROP CONSTRAINT IF EXISTS resolution_records_approval_set_together;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'resolution_records_approver_has_time'
  ) THEN
    ALTER TABLE resolution_records ADD CONSTRAINT resolution_records_approver_has_time
      CHECK (approved_by IS NULL OR approved_at IS NOT NULL);
  END IF;
END $$;

-- Returns false when no such user exists in that tenant. Owned by the
-- migration role so it bypasses RLS; only field_app may call it, and the
-- backend only ever passes the caller's own id + tenant from their JWT.
CREATE OR REPLACE FUNCTION delete_user_account(p_user_id uuid, p_tenant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conversation_ids uuid[];
  v_message_ids uuid[];
BEGIN
  PERFORM 1 FROM users WHERE id = p_user_id AND tenant_id = p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- AI conversations, leaf tables first.
  SELECT coalesce(array_agg(id), '{}') INTO v_conversation_ids
    FROM ai_conversations WHERE user_id = p_user_id;
  SELECT coalesce(array_agg(id), '{}') INTO v_message_ids
    FROM ai_messages WHERE conversation_id = ANY (v_conversation_ids);

  DELETE FROM ai_source_references WHERE message_id = ANY (v_message_ids);
  DELETE FROM ai_feedback WHERE message_id = ANY (v_message_ids);
  DELETE FROM ai_review_items WHERE message_id = ANY (v_message_ids);
  DELETE FROM ai_usage_log
    WHERE user_id = p_user_id OR message_id = ANY (v_message_ids);
  DELETE FROM ai_escalations
    WHERE conversation_id = ANY (v_conversation_ids);
  -- A resolution record distilled from the chat is published knowledge; it
  -- stays, just without its source conversation.
  UPDATE resolution_records SET conversation_id = NULL
    WHERE conversation_id = ANY (v_conversation_ids);
  DELETE FROM ai_messages WHERE id = ANY (v_message_ids);
  DELETE FROM ai_conversations WHERE id = ANY (v_conversation_ids);

  -- Remaining personal data.
  DELETE FROM sessions WHERE user_id = p_user_id;
  DELETE FROM device_registrations WHERE user_id = p_user_id;
  DELETE FROM user_roles WHERE user_id = p_user_id;
  DELETE FROM knowledge_feedback WHERE user_id = p_user_id;
  DELETE FROM calculator_results WHERE user_id = p_user_id;
  DELETE FROM user_favourite_tools WHERE user_id = p_user_id;

  -- Shared tenant records: detach the user.
  UPDATE machines SET created_by = NULL WHERE created_by = p_user_id;
  UPDATE component_replacement_records SET replaced_by = NULL WHERE replaced_by = p_user_id;
  UPDATE technical_history_entries SET created_by = NULL WHERE created_by = p_user_id;
  UPDATE configuration_snapshots SET taken_by = NULL WHERE taken_by = p_user_id;
  UPDATE knowledge_items SET created_by = NULL WHERE created_by = p_user_id;
  UPDATE document_versions SET uploaded_by = NULL WHERE uploaded_by = p_user_id;
  UPDATE resolution_records SET authored_by = NULL WHERE authored_by = p_user_id;
  UPDATE resolution_records SET approved_by = NULL WHERE approved_by = p_user_id;
  UPDATE review_queue_items SET submitted_by = NULL WHERE submitted_by = p_user_id;
  UPDATE review_queue_items SET reviewed_by = NULL WHERE reviewed_by = p_user_id;
  UPDATE ai_escalations SET escalated_by = NULL WHERE escalated_by = p_user_id;
  UPDATE ai_escalations SET escalated_to = NULL WHERE escalated_to = p_user_id;
  UPDATE support_cases SET assigned_to = NULL WHERE assigned_to = p_user_id;
  UPDATE support_updates SET created_by = NULL WHERE created_by = p_user_id;
  UPDATE support_escalations SET escalated_by = NULL WHERE escalated_by = p_user_id;
  -- audit_logs is append-only for the app; this is the one sanctioned
  -- rewrite, so the trail survives without pointing at a deleted user.
  UPDATE audit_logs SET user_id = NULL WHERE user_id = p_user_id;

  DELETE FROM users WHERE id = p_user_id;

  INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id)
  VALUES (p_tenant_id, NULL, 'delete', 'user', p_user_id);

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION delete_user_account(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delete_user_account(uuid, uuid) TO field_app;

INSERT INTO schema_migrations (version)
VALUES ('0025_delete_user_account')
ON CONFLICT (version) DO NOTHING;
