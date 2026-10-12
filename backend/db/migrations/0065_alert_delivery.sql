-- Section 8d: alert rules start sending (Settings → Notifications &
-- alerts, migration 0045). The rule engine (src/alertEngine) finds
-- matches per organisation, writes one in-app notification per recipient
-- (the existing notifications table, kind 'alert') and records each
-- channel's delivery. Every function takes the organisation and filters
-- on it: a rule never reaches another organisation's users.

ALTER TABLE alert_rules
  ADD COLUMN IF NOT EXISTS cooldown_minutes integer NOT NULL DEFAULT 240;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'alert_rules_cooldown_minutes_check') THEN
    ALTER TABLE alert_rules ADD CONSTRAINT alert_rules_cooldown_minutes_check
      CHECK (cooldown_minutes BETWEEN 0 AND 10080);
  END IF;
END
$$;

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS rule_id uuid REFERENCES alert_rules(id) ON DELETE SET NULL,
  -- What the alert is about, e.g. machine:<id> or case:<id>; the cooldown
  -- is per rule + user + entity.
  ADD COLUMN IF NOT EXISTS entity_key text;

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_kind_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_kind_check CHECK (kind IN (
  'case_message', 'case_assigned', 'case_status', 'case_priority',
  'machine_status', 'ai_review', 'knowledge_document', 'alert'));

CREATE INDEX IF NOT EXISTS idx_notifications_alert_cooldown
  ON notifications (rule_id, user_id, entity_key, created_at DESC)
  WHERE rule_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS notification_deliveries (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            uuid NOT NULL REFERENCES tenants(id),
  notification_id      uuid NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  channel              text NOT NULL CHECK (channel IN ('in_app', 'push', 'email', 'sms')),
  status               text NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
  provider_message_id  text,
  error                text,
  sent_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_notification
  ON notification_deliveries (notification_id);

ALTER TABLE notification_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_deliveries FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notification_deliveries_select ON notification_deliveries;
CREATE POLICY notification_deliveries_select ON notification_deliveries
  FOR SELECT USING (tenant_id = current_tenant_id());
-- Written only through alert_record_delivery.
REVOKE INSERT, UPDATE, DELETE ON notification_deliveries FROM field_app;

-- Live bell: each new notification (alerts and the 0054 triggers alike)
-- is announced to the API, which pushes it to that user's socket room.
CREATE OR REPLACE FUNCTION announce_notification()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM pg_notify('user_notification',
    json_build_object('userId', NEW.user_id, 'notificationId', NEW.id)::text);
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_notifications_announce ON notifications;
CREATE TRIGGER trg_notifications_announce
  AFTER INSERT ON notifications
  FOR EACH ROW EXECUTE FUNCTION announce_notification();

-- Enabled rules of the given types across organisations, with each
-- organisation's channel switches (all on until the settings page is
-- first saved).
CREATE OR REPLACE FUNCTION alert_list_enabled_rules(p_trigger_types text[], p_tenant_id uuid)
RETURNS TABLE (
  id uuid, tenant_id uuid, name text, trigger_type text, trigger_params jsonb,
  audiences text[], channels text[], cooldown_minutes integer,
  push_enabled boolean, email_enabled boolean, sms_enabled boolean
)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT r.id, r.tenant_id, r.name::text, r.trigger_type::text, r.trigger_params,
         r.audiences::text[], r.channels::text[], r.cooldown_minutes,
         COALESCE(s.push_enabled, true), COALESCE(s.email_enabled, true), COALESCE(s.sms_enabled, true)
  FROM alert_rules r
  JOIN tenants t ON t.id = r.tenant_id AND t.deleted_at IS NULL
  LEFT JOIN notification_channel_settings s ON s.tenant_id = r.tenant_id
  WHERE r.deleted_at IS NULL AND r.is_enabled
    AND r.trigger_type = ANY (p_trigger_types)
    AND (p_tenant_id IS NULL OR r.tenant_id = p_tenant_id);
$$;

-- One rule of the organisation whether it's on or off (Send test).
CREATE OR REPLACE FUNCTION alert_find_rule(p_tenant_id uuid, p_rule_id uuid)
RETURNS TABLE (
  id uuid, tenant_id uuid, name text, trigger_type text, trigger_params jsonb,
  audiences text[], channels text[], cooldown_minutes integer,
  push_enabled boolean, email_enabled boolean, sms_enabled boolean
)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT r.id, r.tenant_id, r.name::text, r.trigger_type::text, r.trigger_params,
         r.audiences::text[], r.channels::text[], r.cooldown_minutes,
         COALESCE(s.push_enabled, true), COALESCE(s.email_enabled, true), COALESCE(s.sms_enabled, true)
  FROM alert_rules r
  LEFT JOIN notification_channel_settings s ON s.tenant_id = r.tenant_id
  WHERE r.id = p_rule_id AND r.tenant_id = p_tenant_id AND r.deleted_at IS NULL;
$$;

-- Machines whose current status is p_status and has been since before
-- p_hours ago (from the status history, migration 0053).
CREATE OR REPLACE FUNCTION alert_find_machines_in_status(p_tenant_id uuid, p_status text, p_hours integer)
RETURNS TABLE (machine_id uuid, label text, detail text, since timestamptz)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT m.id,
         COALESCE(NULLIF(m.asset_number, ''), NULLIF(m.fleet_number, ''), m.serial_number)::text,
         concat_ws(' · ', mf.name || ' ' || mm.name, NULLIF(m.site, ''))::text,
         latest.changed_at
  FROM machines m
  JOIN machine_manufacturers mf ON mf.id = m.manufacturer_id
  JOIN machine_models mm ON mm.id = m.model_id
  JOIN LATERAL (
    SELECT e.status, e.changed_at FROM machine_status_events e
    WHERE e.machine_id = m.id ORDER BY e.changed_at DESC LIMIT 1
  ) latest ON true
  WHERE m.tenant_id = p_tenant_id AND m.deleted_at IS NULL
    AND m.status = p_status AND latest.status = p_status
    AND latest.changed_at <= now() - make_interval(hours => p_hours);
$$;

-- Open cases of p_priority older than p_minutes that nobody but the
-- reporter has replied to.
CREATE OR REPLACE FUNCTION alert_find_unactioned_cases(p_tenant_id uuid, p_priority text, p_minutes integer)
RETURNS TABLE (case_id uuid, case_number bigint, subject text, site text, created_at timestamptz)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT c.id, c.case_number, c.subject::text, NULLIF(m.site, '')::text, c.created_at
  FROM support_cases c
  LEFT JOIN machines m ON m.id = c.machine_id
  WHERE c.tenant_id = p_tenant_id AND c.deleted_at IS NULL
    AND c.status = 'open' AND c.priority = p_priority
    AND c.created_at <= now() - make_interval(mins => p_minutes)
    AND NOT EXISTS (
      SELECT 1 FROM support_updates u
      WHERE u.support_case_id = c.id AND u.created_by IS DISTINCT FROM c.created_by
    );
$$;

-- Everyone in the organisation a rule could notify, with what links them
-- to the alert's machine or case. src/alertEngine/resolveRecipients.ts
-- turns audiences into people from these flags.
CREATE OR REPLACE FUNCTION alert_list_recipient_candidates(p_tenant_id uuid, p_machine_id uuid, p_case_id uuid)
RETURNS TABLE (
  user_id uuid, tenant_id uuid, first_name text, email text, phone_number text,
  role_names text[], is_case_assignee boolean, has_worked_on_machine boolean,
  has_reviewed_answers boolean
)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT u.id, u.tenant_id, u.first_name::text, u.email::text, u.phone_number::text,
         COALESCE((SELECT array_agg(r.name::text) FROM user_roles ur JOIN roles r ON r.id = ur.role_id
                   WHERE ur.user_id = u.id AND r.deleted_at IS NULL), '{}'),
         EXISTS (SELECT 1 FROM support_cases c
                 WHERE c.id = p_case_id AND c.tenant_id = p_tenant_id AND c.assigned_to = u.id),
         EXISTS (SELECT 1 FROM technical_history_entries h
                 WHERE h.machine_id = p_machine_id AND h.tenant_id = p_tenant_id
                   AND h.created_by = u.id AND h.deleted_at IS NULL
                   AND h.created_at >= now() - interval '90 days'),
         EXISTS (SELECT 1 FROM ai_review_items ri
                 WHERE ri.tenant_id = p_tenant_id AND ri.reviewer_id = u.id)
  FROM users u
  WHERE u.tenant_id = p_tenant_id AND u.deleted_at IS NULL AND u.status = 'active';
$$;

-- Writes the alert's in-app notification unless the same rule already
-- alerted this user about this entity within the cooldown. Returns the new
-- notification id, or NULL (cooling down, or the user isn't in
-- p_tenant_id). The advisory lock makes two concurrent runs agree.
CREATE OR REPLACE FUNCTION alert_record_notification(
  p_tenant_id uuid, p_user_id uuid, p_rule_id uuid, p_entity_key text,
  p_cooldown_minutes integer, p_title text, p_body text, p_link text
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_rule_id::text || p_user_id::text || p_entity_key));
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_user_id AND tenant_id = p_tenant_id AND deleted_at IS NULL) THEN
    RETURN NULL;
  END IF;
  IF EXISTS (
    SELECT 1 FROM notifications
    WHERE rule_id = p_rule_id AND user_id = p_user_id AND entity_key = p_entity_key
      AND created_at > now() - make_interval(mins => p_cooldown_minutes)
  ) THEN
    RETURN NULL;
  END IF;
  INSERT INTO notifications (tenant_id, user_id, kind, title, body, link, rule_id, entity_key)
  VALUES (p_tenant_id, p_user_id, 'alert', p_title, p_body, p_link, p_rule_id, p_entity_key)
  RETURNING id INTO v_id;
  RETURN v_id;
END
$$;

CREATE OR REPLACE FUNCTION alert_record_delivery(
  p_notification_id uuid, p_channel text, p_status text,
  p_provider_message_id text, p_error text
)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  INSERT INTO notification_deliveries (tenant_id, notification_id, channel, status, provider_message_id, error)
  SELECT n.tenant_id, n.id, p_channel, p_status, p_provider_message_id, left(p_error, 500)
  FROM notifications n WHERE n.id = p_notification_id;
$$;

REVOKE ALL ON FUNCTION alert_list_enabled_rules(text[], uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION alert_list_enabled_rules(text[], uuid) TO field_app;
REVOKE ALL ON FUNCTION alert_find_rule(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION alert_find_rule(uuid, uuid) TO field_app;
REVOKE ALL ON FUNCTION alert_find_machines_in_status(uuid, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION alert_find_machines_in_status(uuid, text, integer) TO field_app;
REVOKE ALL ON FUNCTION alert_find_unactioned_cases(uuid, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION alert_find_unactioned_cases(uuid, text, integer) TO field_app;
REVOKE ALL ON FUNCTION alert_list_recipient_candidates(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION alert_list_recipient_candidates(uuid, uuid, uuid) TO field_app;
REVOKE ALL ON FUNCTION alert_record_notification(uuid, uuid, uuid, text, integer, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION alert_record_notification(uuid, uuid, uuid, text, integer, text, text, text) TO field_app;
REVOKE ALL ON FUNCTION alert_record_delivery(uuid, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION alert_record_delivery(uuid, text, text, text, text) TO field_app;

INSERT INTO schema_migrations (version)
VALUES ('0065_alert_delivery')
ON CONFLICT (version) DO NOTHING;
