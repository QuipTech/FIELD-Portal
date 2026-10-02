-- Section 8c: in-app notifications (the bell and /notifications). Rows are
-- written only by the triggers below, so no code path can forget one:
--   * a reply on a case you reported or are assigned to
--   * a case you reported or are assigned to changes assignee, status or
--     priority (the new assignee is told it's theirs)
--   * a machine you've worked on goes down or becomes due for service
--   * an AI answer of yours that went to the review queue is resolved or
--     escalated
--   * a document goes live in Knowledge (your organisation's, or the
--     shared library, which tells every organisation)
-- Nobody is notified about their own action: the actor is the row's
-- author where there is one, else app.user_id (set by the backend for
-- the transaction).

CREATE TABLE IF NOT EXISTS notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  -- CASCADE so delete_user_account() removes them with the user.
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        varchar NOT NULL CHECK (kind IN (
                'case_message', 'case_assigned', 'case_status', 'case_priority',
                'machine_status', 'ai_review', 'knowledge_document')),
  title       text NOT NULL,
  body        text,
  -- Portal path the notification opens, e.g. /cases/1042.
  link        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  read_at     timestamptz
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications (user_id) WHERE read_at IS NULL;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notifications_select ON notifications;
CREATE POLICY notifications_select ON notifications
  FOR SELECT USING (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS notifications_update ON notifications;
CREATE POLICY notifications_update ON notifications
  FOR UPDATE USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- The app only reads them and marks them read.
REVOKE INSERT, DELETE ON notifications FROM field_app;
REVOKE UPDATE ON notifications FROM field_app;
GRANT UPDATE (read_at) ON notifications TO field_app;

-- Inserts one notification per recipient (active users only; NULLs,
-- duplicates, p_exclude and the transaction's actor are skipped). Each
-- row takes the recipient's own tenant_id.
CREATE OR REPLACE FUNCTION notify_users(
  p_user_ids  uuid[],
  p_exclude   uuid,
  p_kind      varchar,
  p_title     text,
  p_body      text,
  p_link      text
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO notifications (tenant_id, user_id, kind, title, body, link)
  SELECT u.tenant_id, u.id, p_kind, p_title, p_body, p_link
  FROM users u
  WHERE u.id IN (SELECT DISTINCT unnest(p_user_ids))
    AND u.deleted_at IS NULL AND u.status = 'active'
    AND u.id IS DISTINCT FROM p_exclude
    AND u.id IS DISTINCT FROM NULLIF(current_setting('app.user_id', true), '')::uuid;
$$;

REVOKE ALL ON FUNCTION notify_users(uuid[], uuid, varchar, text, text, text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION notify_case_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_case    support_cases%ROWTYPE;
  v_author  text;
BEGIN
  SELECT * INTO v_case FROM support_cases WHERE id = NEW.support_case_id;
  SELECT first_name || ' ' || last_name INTO v_author FROM users WHERE id = NEW.created_by;
  PERFORM notify_users(
    ARRAY[v_case.created_by, v_case.assigned_to], NEW.created_by, 'case_message',
    'New reply on case #' || v_case.case_number,
    COALESCE(v_author || ': ', '') || left(regexp_replace(NEW.note, '\s+', ' ', 'g'), 140),
    '/cases/' || v_case.case_number);
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_support_updates_notify ON support_updates;
CREATE TRIGGER trg_support_updates_notify
  AFTER INSERT ON support_updates
  FOR EACH ROW EXECUTE FUNCTION notify_case_message();

CREATE OR REPLACE FUNCTION notify_case_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link text := '/cases/' || NEW.case_number;
BEGIN
  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to AND NEW.assigned_to IS NOT NULL THEN
    PERFORM notify_users(ARRAY[NEW.assigned_to], NULL, 'case_assigned',
      'Case #' || NEW.case_number || ' was assigned to you', NEW.subject, v_link);
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM notify_users(ARRAY[NEW.created_by, NEW.assigned_to], NULL, 'case_status',
      'Case #' || NEW.case_number || ' is now '
        || CASE NEW.status WHEN 'in_progress' THEN 'in progress' ELSE NEW.status END,
      NEW.subject, v_link);
  END IF;
  IF NEW.priority IS DISTINCT FROM OLD.priority THEN
    PERFORM notify_users(ARRAY[NEW.created_by, NEW.assigned_to], NULL, 'case_priority',
      'Case #' || NEW.case_number || ' priority changed to ' || NEW.priority,
      NEW.subject, v_link);
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_support_cases_notify ON support_cases;
CREATE TRIGGER trg_support_cases_notify
  AFTER UPDATE OF assigned_to, status, priority ON support_cases
  FOR EACH ROW EXECUTE FUNCTION notify_case_change();

-- "Worked on" matches the dashboard's My machines: registered it, logged
-- history on it, raised a case for it, or asked the assistant about it.
-- A machine's first status event (registration, or 0053's starting
-- point) isn't a change and notifies nobody.
CREATE OR REPLACE FUNCTION notify_machine_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_label       text;
  v_detail      text;
  v_recipients  uuid[];
BEGIN
  IF NEW.status NOT IN ('down', 'service_due') OR NOT EXISTS (
    SELECT 1 FROM machine_status_events e
    WHERE e.machine_id = NEW.machine_id AND e.id <> NEW.id
  ) THEN
    RETURN NEW;
  END IF;
  SELECT COALESCE(NULLIF(m.asset_number, ''), NULLIF(m.fleet_number, ''), m.serial_number),
         concat_ws(' · ', mf.name || ' ' || mm.name, m.site)
    INTO v_label, v_detail
  FROM machines m
  JOIN machine_manufacturers mf ON mf.id = m.manufacturer_id
  JOIN machine_models mm ON mm.id = m.model_id
  WHERE m.id = NEW.machine_id;
  SELECT array_agg(user_id) INTO v_recipients FROM (
    SELECT created_by AS user_id FROM machines WHERE id = NEW.machine_id
    UNION SELECT created_by FROM technical_history_entries
      WHERE machine_id = NEW.machine_id AND deleted_at IS NULL
    UNION SELECT created_by FROM support_cases
      WHERE machine_id = NEW.machine_id AND deleted_at IS NULL
    UNION SELECT user_id FROM ai_conversations
      WHERE machine_id = NEW.machine_id AND deleted_at IS NULL
  ) workers;
  PERFORM notify_users(v_recipients, NEW.changed_by, 'machine_status',
    v_label || CASE NEW.status WHEN 'down' THEN ' is down' ELSE ' is due for service' END,
    v_detail, '/machines/' || NEW.machine_id || '/history');
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_machine_status_events_notify ON machine_status_events;
CREATE TRIGGER trg_machine_status_events_notify
  AFTER INSERT ON machine_status_events
  FOR EACH ROW EXECUTE FUNCTION notify_machine_status();

CREATE OR REPLACE FUNCTION notify_ai_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conversation  ai_conversations%ROWTYPE;
BEGIN
  IF NEW.status NOT IN ('resolved', 'escalated') OR NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;
  SELECT c.* INTO v_conversation
  FROM ai_messages m JOIN ai_conversations c ON c.id = m.conversation_id
  WHERE m.id = NEW.message_id;
  PERFORM notify_users(ARRAY[v_conversation.user_id], NEW.reviewer_id, 'ai_review',
    'An AI answer you received was '
      || CASE NEW.status WHEN 'resolved' THEN 'reviewed' ELSE 'escalated to an expert' END,
    concat_ws(' · ', v_conversation.title, left(NEW.notes, 140)),
    '/assistant?thread=' || v_conversation.id);
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_ai_review_items_notify ON ai_review_items;
CREATE TRIGGER trg_ai_review_items_notify
  AFTER UPDATE OF status ON ai_review_items
  FOR EACH ROW EXECUTE FUNCTION notify_ai_review();

-- Only a document's first live version counts as "added"; a new version
-- of an existing document doesn't notify.
CREATE OR REPLACE FUNCTION notify_knowledge_live()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item        knowledge_items%ROWTYPE;
  v_recipients  uuid[];
BEGIN
  IF OLD.live_version_id IS NOT NULL OR NEW.live_version_id IS NULL OR NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  SELECT * INTO v_item FROM knowledge_items WHERE id = NEW.knowledge_item_id;
  SELECT array_agg(u.id) INTO v_recipients FROM users u
  WHERE v_item.tenant_id IS NULL OR u.tenant_id = v_item.tenant_id;
  PERFORM notify_users(v_recipients, v_item.created_by, 'knowledge_document',
    'New in Knowledge: ' || v_item.title,
    concat_ws(' · ', initcap(replace(v_item.type, '_', ' ')),
              CASE WHEN v_item.tenant_id IS NULL THEN 'Shared library' END),
    '/knowledge');
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_documents_notify_live ON documents;
CREATE TRIGGER trg_documents_notify_live
  AFTER UPDATE OF live_version_id ON documents
  FOR EACH ROW EXECUTE FUNCTION notify_knowledge_live();

INSERT INTO schema_migrations (version)
VALUES ('0054_user_notifications')
ON CONFLICT (version) DO NOTHING;
