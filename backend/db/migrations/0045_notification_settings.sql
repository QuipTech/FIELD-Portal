-- Section 1l: Settings → Notifications & alerts. Each organisation's alert
-- rules (what to watch, who to tell, over which channels) and its
-- organisation-wide delivery channel switches. Configuration only: nothing
-- evaluates the rules or sends anything yet. Tenant-scoped with RLS like
-- every other tenant table; the backend works through withTenant().

CREATE TABLE IF NOT EXISTS notification_channel_settings (
  tenant_id      uuid PRIMARY KEY REFERENCES tenants(id),
  push_enabled   boolean NOT NULL DEFAULT true,
  email_enabled  boolean NOT NULL DEFAULT true,
  sms_enabled    boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  row_version    integer NOT NULL DEFAULT 1
);

DROP TRIGGER IF EXISTS trg_notification_channel_settings_bump_row_version ON notification_channel_settings;
CREATE TRIGGER trg_notification_channel_settings_bump_row_version
  BEFORE UPDATE ON notification_channel_settings
  FOR EACH ROW EXECUTE FUNCTION bump_row_version();

ALTER TABLE notification_channel_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_channel_settings FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notification_channel_settings_select ON notification_channel_settings;
CREATE POLICY notification_channel_settings_select ON notification_channel_settings
  FOR SELECT USING (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS notification_channel_settings_insert ON notification_channel_settings;
CREATE POLICY notification_channel_settings_insert ON notification_channel_settings
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS notification_channel_settings_update ON notification_channel_settings;
CREATE POLICY notification_channel_settings_update ON notification_channel_settings
  FOR UPDATE USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- trigger_type + trigger_params are validated by the backend against its
-- trigger catalog (organisationNotifications/alertTriggerCatalog.ts), so a
-- future rule engine can evaluate them; audiences/channels likewise.
CREATE TABLE IF NOT EXISTS alert_rules (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  name            varchar NOT NULL,
  trigger_type    varchar NOT NULL,
  trigger_params  jsonb NOT NULL DEFAULT '{}'::jsonb,
  audiences       varchar[] NOT NULL DEFAULT '{}',
  channels        varchar[] NOT NULL DEFAULT '{}'
                    CHECK (channels <@ ARRAY['push', 'email', 'sms']::varchar[]),
  is_enabled      boolean NOT NULL DEFAULT true,
  sort_order      integer NOT NULL DEFAULT 0,
  -- SET NULL so delete_user_account() (0025) can still hard-delete an admin.
  created_by      uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  row_version     integer NOT NULL DEFAULT 1,
  deleted_at      timestamptz
);

CREATE INDEX IF NOT EXISTS idx_alert_rules_tenant_id ON alert_rules(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_alert_rules_live_name
  ON alert_rules (tenant_id, lower(name)) WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_alert_rules_bump_row_version ON alert_rules;
CREATE TRIGGER trg_alert_rules_bump_row_version
  BEFORE UPDATE ON alert_rules
  FOR EACH ROW EXECUTE FUNCTION bump_row_version();

ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_rules FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS alert_rules_select ON alert_rules;
CREATE POLICY alert_rules_select ON alert_rules
  FOR SELECT USING (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS alert_rules_insert ON alert_rules;
CREATE POLICY alert_rules_insert ON alert_rules
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS alert_rules_update ON alert_rules;
CREATE POLICY alert_rules_update ON alert_rules
  FOR UPDATE USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

GRANT SELECT, INSERT, UPDATE ON notification_channel_settings, alert_rules TO field_app;

INSERT INTO schema_migrations (version)
VALUES ('0045_notification_settings')
ON CONFLICT (version) DO NOTHING;
