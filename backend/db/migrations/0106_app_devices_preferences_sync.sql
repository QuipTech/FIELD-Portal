-- Section 1m: the mobile app's push tokens, notification preferences and
-- offline write queue.
--   * device_registrations (0005) gain app_version and last_seen_at, one
--     row per user and token, and can be deleted (sign-out).
--   * user_notification_preferences: per person — push and email on/off,
--     and notification kinds they've muted. Absent = everything on.
--   * idempotency_keys: the app's outbox replays queued writes (history
--     entries, photos, case replies) with an Idempotency-Key header; the
--     first response is kept and returned for every retry.

ALTER TABLE device_registrations
  ADD COLUMN IF NOT EXISTS app_version varchar,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz NOT NULL DEFAULT now();

-- Older duplicates would block the unique index; keep the newest.
DELETE FROM device_registrations d
USING device_registrations newer
WHERE newer.user_id = d.user_id AND newer.push_token = d.push_token
  AND (newer.created_at, newer.id) > (d.created_at, d.id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_device_registrations_user_token
  ON device_registrations (user_id, push_token);

DROP POLICY IF EXISTS device_registrations_delete ON device_registrations;
CREATE POLICY device_registrations_delete ON device_registrations
  FOR DELETE USING (tenant_id = current_tenant_id());
GRANT DELETE ON device_registrations TO field_app;

CREATE TABLE IF NOT EXISTS user_notification_preferences (
  user_id        uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  tenant_id      uuid NOT NULL REFERENCES tenants(id),
  push_enabled   boolean NOT NULL DEFAULT true,
  email_enabled  boolean NOT NULL DEFAULT true,
  -- notifications.kind values (0054) the person doesn't want pushed.
  muted_kinds    varchar[] NOT NULL DEFAULT '{}',
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notification_preferences FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_notification_preferences_all ON user_notification_preferences;
CREATE POLICY user_notification_preferences_all ON user_notification_preferences
  FOR ALL USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE TABLE IF NOT EXISTS idempotency_keys (
  user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key              varchar(100) NOT NULL,
  tenant_id        uuid NOT NULL REFERENCES tenants(id),
  -- "POST /machines/…/history": a key can't be reused for another request.
  route            varchar NOT NULL,
  status           varchar NOT NULL DEFAULT 'in_progress'
                     CHECK (status IN ('in_progress', 'done')),
  response_status  integer,
  response_body    jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  completed_at     timestamptz,
  PRIMARY KEY (user_id, key)
);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_created ON idempotency_keys (created_at);

ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency_keys FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS idempotency_keys_all ON idempotency_keys;
CREATE POLICY idempotency_keys_all ON idempotency_keys
  FOR ALL USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
GRANT DELETE ON idempotency_keys TO field_app;

INSERT INTO schema_migrations (version)
VALUES ('0106_app_devices_preferences_sync')
ON CONFLICT (version) DO NOTHING;
