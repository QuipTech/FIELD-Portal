-- Section 8b: usage metering. Every AI query, asset added, seat added or
-- removed, and session started writes an app.usage_events row — from
-- first deployment, on every plan, whether or not it's billed. Database
-- triggers (not application code) record them, so no code path can skip
-- metering, and the tenant role never needs write access to app.
--
-- The trigger functions are SECURITY DEFINER: they insert into
-- app.usage_events as the migration owner, which field_app cannot do.

CREATE OR REPLACE FUNCTION app.record_usage_event(
  p_tenant_id   uuid,
  p_event_type  varchar,
  p_user_id     uuid,
  p_subject_id  uuid,
  p_metadata    jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO app.usage_events (tenant_id, event_type, user_id, subject_id, metadata)
  VALUES (p_tenant_id, p_event_type, p_user_id, p_subject_id, p_metadata);
$$;

REVOKE ALL ON FUNCTION app.record_usage_event(uuid, varchar, uuid, uuid, jsonb) FROM PUBLIC;

-- A technician's message to the assistant = one AI query.
CREATE OR REPLACE FUNCTION app.meter_ai_query()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM app.record_usage_event(
    NEW.tenant_id, 'ai_query',
    (SELECT c.user_id FROM ai_conversations c WHERE c.id = NEW.conversation_id),
    NEW.id,
    jsonb_build_object('conversationId', NEW.conversation_id));
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_ai_messages_meter_ai_query ON ai_messages;
CREATE TRIGGER trg_ai_messages_meter_ai_query
  AFTER INSERT ON ai_messages
  FOR EACH ROW WHEN (NEW.role = 'user')
  EXECUTE FUNCTION app.meter_ai_query();

CREATE OR REPLACE FUNCTION app.meter_asset_added()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM app.record_usage_event(NEW.tenant_id, 'asset_added', NEW.created_by, NEW.id,
    jsonb_build_object('modelId', NEW.model_id));
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_machines_meter_asset_added ON machines;
CREATE TRIGGER trg_machines_meter_asset_added
  AFTER INSERT ON machines
  FOR EACH ROW EXECUTE FUNCTION app.meter_asset_added();

-- Seats: a user row created, soft-deleted or hard-deleted (account
-- deletion). The removal event keeps no user id — the person is gone.
CREATE OR REPLACE FUNCTION app.meter_seat_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM app.record_usage_event(NEW.tenant_id, 'seat_added', NEW.id, NEW.id);
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM app.record_usage_event(NEW.tenant_id, 'seat_removed', NULL, NULL,
      jsonb_build_object('reason', 'deactivated'));
  ELSE
    PERFORM app.record_usage_event(OLD.tenant_id, 'seat_removed', NULL, NULL,
      jsonb_build_object('reason', 'account_deleted'));
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_meter_seat_added ON users;
CREATE TRIGGER trg_users_meter_seat_added
  AFTER INSERT ON users
  FOR EACH ROW EXECUTE FUNCTION app.meter_seat_change();

DROP TRIGGER IF EXISTS trg_users_meter_seat_deactivated ON users;
CREATE TRIGGER trg_users_meter_seat_deactivated
  AFTER UPDATE OF deleted_at ON users
  FOR EACH ROW WHEN (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL)
  EXECUTE FUNCTION app.meter_seat_change();

-- Skipped when the user was already soft-deleted (already counted).
DROP TRIGGER IF EXISTS trg_users_meter_seat_deleted ON users;
CREATE TRIGGER trg_users_meter_seat_deleted
  AFTER DELETE ON users
  FOR EACH ROW WHEN (OLD.deleted_at IS NULL)
  EXECUTE FUNCTION app.meter_seat_change();

CREATE OR REPLACE FUNCTION app.meter_session_started()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM app.record_usage_event(NEW.tenant_id, 'session_started', NEW.user_id, NEW.id);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sessions_meter_session_started ON sessions;
CREATE TRIGGER trg_sessions_meter_session_started
  AFTER INSERT ON sessions
  FOR EACH ROW EXECUTE FUNCTION app.meter_session_started();

INSERT INTO schema_migrations (version)
VALUES ('0047_usage_metering')
ON CONFLICT (version) DO NOTHING;
