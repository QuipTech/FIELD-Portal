-- Section 8c: retention rules.
--
--   Config snapshots + diffs (CMDB)  never auto-deleted, on any plan
--   Usage metering (app.usage_events) always written (0047), never purged
--   Audit log                         append-only: no UPDATE/DELETE grants
--   AI query logs                     kept for each organisation's retention
--                                     period (default 12 months), purged
--                                     nightly by purge_expired_ai_query_logs()

-- ── Append-only audit log ──────────────────────────────────────────────
-- 0002's default privileges gave field_app UPDATE; take it (and any
-- DELETE/TRUNCATE) away from both application roles. delete_user_account
-- (SECURITY DEFINER) still anonymises user_id — the one sanctioned change.
REVOKE UPDATE, DELETE, TRUNCATE ON audit_logs FROM field_app, field_service;
GRANT SELECT, INSERT ON audit_logs TO field_app;

-- ── Configuration snapshots: never deleted by the application ─────────
REVOKE DELETE, TRUNCATE ON configuration_snapshots, configuration_snapshot_items
  FROM field_app, field_service;

-- ── AI query log retention ─────────────────────────────────────────────
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS ai_query_log_retention_months integer NOT NULL DEFAULT 12;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenants_ai_query_log_retention_months') THEN
    ALTER TABLE tenants ADD CONSTRAINT tenants_ai_query_log_retention_months
      CHECK (ai_query_log_retention_months IN (6, 12, 24));
  END IF;
END
$$;

-- Deletes AI conversations whose last message is older than their
-- organisation's retention period — messages, citations, feedback, cost
-- log rows and resolved review items with them. Kept regardless: any
-- conversation with an open review item or escalation (someone is still
-- looking at it), and resolution records (published knowledge; they just
-- lose the link). usage_events are separate and are never purged.
-- One audit row per organisation that had anything removed. A
-- transaction-scoped advisory lock makes concurrent runs (several API
-- instances) skip rather than collide.
CREATE OR REPLACE FUNCTION purge_expired_ai_query_logs()
RETURNS TABLE (tenant_id uuid, conversations_deleted integer, messages_deleted integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant RECORD;
  v_conversation_ids uuid[];
  v_message_ids uuid[];
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtext('purge_expired_ai_query_logs')) THEN
    RETURN;
  END IF;

  FOR v_tenant IN
    SELECT t.id, t.ai_query_log_retention_months AS months FROM tenants t
  LOOP
    SELECT coalesce(array_agg(c.id), '{}') INTO v_conversation_ids
    FROM ai_conversations c
    WHERE c.tenant_id = v_tenant.id
      AND COALESCE(
            (SELECT max(m.created_at) FROM ai_messages m WHERE m.conversation_id = c.id),
            c.created_at
          ) < now() - make_interval(months => v_tenant.months)
      AND NOT EXISTS (
        SELECT 1 FROM ai_review_items ri
        JOIN ai_messages rm ON rm.id = ri.message_id
        WHERE rm.conversation_id = c.id AND ri.status IN ('unreviewed', 'in_review', 'escalated'))
      AND NOT EXISTS (
        SELECT 1 FROM ai_escalations e
        WHERE e.conversation_id = c.id AND e.status = 'pending');

    CONTINUE WHEN cardinality(v_conversation_ids) = 0;

    SELECT coalesce(array_agg(m.id), '{}') INTO v_message_ids
    FROM ai_messages m WHERE m.conversation_id = ANY (v_conversation_ids);

    -- Leaf tables first, in the same order as delete_user_account().
    DELETE FROM ai_source_references WHERE message_id = ANY (v_message_ids);
    DELETE FROM ai_feedback WHERE message_id = ANY (v_message_ids);
    DELETE FROM ai_review_items WHERE message_id = ANY (v_message_ids);
    DELETE FROM ai_usage_log WHERE message_id = ANY (v_message_ids);
    DELETE FROM ai_escalations WHERE conversation_id = ANY (v_conversation_ids);
    UPDATE resolution_records SET conversation_id = NULL
      WHERE conversation_id = ANY (v_conversation_ids);
    DELETE FROM ai_messages WHERE id = ANY (v_message_ids);
    DELETE FROM ai_conversations WHERE id = ANY (v_conversation_ids);

    INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, metadata, source)
    VALUES (v_tenant.id, NULL, 'delete', 'ai_query_logs', v_tenant.id,
            jsonb_build_object(
              'retentionMonths', v_tenant.months,
              'conversationsDeleted', cardinality(v_conversation_ids),
              'messagesDeleted', cardinality(v_message_ids)),
            'system');

    tenant_id := v_tenant.id;
    conversations_deleted := cardinality(v_conversation_ids);
    messages_deleted := cardinality(v_message_ids);
    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION purge_expired_ai_query_logs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION purge_expired_ai_query_logs() TO field_app, field_service;

INSERT INTO schema_migrations (version)
VALUES ('0048_retention_rules')
ON CONFLICT (version) DO NOTHING;
