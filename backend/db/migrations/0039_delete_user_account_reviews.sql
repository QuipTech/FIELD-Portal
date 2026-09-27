-- Section 3h (cont.): account deletion also detaches the user from the
-- documents they reviewed (knowledge_items.reviewed_by, 0035). Otherwise
-- identical to 0033.
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
  UPDATE technical_attachments SET uploaded_by = NULL WHERE uploaded_by = p_user_id;
  UPDATE component_replacement_records SET replaced_by = NULL WHERE replaced_by = p_user_id;
  UPDATE technical_history_entries SET created_by = NULL WHERE created_by = p_user_id;
  UPDATE configuration_snapshots SET taken_by = NULL WHERE taken_by = p_user_id;
  UPDATE knowledge_items SET created_by = NULL WHERE created_by = p_user_id;
  UPDATE knowledge_items SET reviewed_by = NULL WHERE reviewed_by = p_user_id;
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

INSERT INTO schema_migrations (version)
VALUES ('0039_delete_user_account_reviews')
ON CONFLICT (version) DO NOTHING;
