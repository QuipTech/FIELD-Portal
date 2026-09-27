-- Section 4d: ai_model_configurations (platform-managed, not
-- tenant-editable — ADR-002) and ai_usage_log. field_app gets SELECT only
-- on ai_model_configurations; there is no tenant-facing endpoint that can
-- change the AI provider or model.

CREATE TABLE IF NOT EXISTS ai_model_configurations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  provider        varchar NOT NULL DEFAULT 'bedrock' CHECK (provider = 'bedrock'),
  model_name      varchar NOT NULL CHECK (model_name LIKE 'au.%'),
  region          varchar NOT NULL DEFAULT 'ap-southeast-2' CHECK (region = 'ap-southeast-2'),
  prompt_version  varchar NOT NULL,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  row_version     integer NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_ai_model_configurations_tenant_id ON ai_model_configurations(tenant_id);

-- One active row per tenant.
CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_model_configurations_active_per_tenant
  ON ai_model_configurations(tenant_id) WHERE is_active;

DROP TRIGGER IF EXISTS trg_ai_model_configurations_bump_row_version ON ai_model_configurations;
CREATE TRIGGER trg_ai_model_configurations_bump_row_version
  BEFORE UPDATE ON ai_model_configurations
  FOR EACH ROW EXECUTE FUNCTION bump_row_version();

ALTER TABLE ai_model_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_model_configurations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_model_configurations_select ON ai_model_configurations;
CREATE POLICY ai_model_configurations_select ON ai_model_configurations
  FOR SELECT USING (tenant_id = current_tenant_id());

-- Narrow the blanket grant from ALTER DEFAULT PRIVILEGES (0002) down to
-- read-only for this one table.
REVOKE INSERT, UPDATE, DELETE ON ai_model_configurations FROM field_app;

CREATE TABLE IF NOT EXISTS ai_usage_log (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES tenants(id),
  user_id        uuid NOT NULL REFERENCES users(id),
  message_id     uuid NOT NULL REFERENCES ai_messages(id),
  tokens_used    integer NOT NULL,
  cost_estimate  double precision NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_log_tenant_id ON ai_usage_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_user_id ON ai_usage_log(user_id);

ALTER TABLE ai_usage_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_log FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_usage_log_select ON ai_usage_log;
CREATE POLICY ai_usage_log_select ON ai_usage_log
  FOR SELECT USING (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS ai_usage_log_insert ON ai_usage_log;
CREATE POLICY ai_usage_log_insert ON ai_usage_log
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());

INSERT INTO schema_migrations (version)
VALUES ('0019_ai_model_config_usage')
ON CONFLICT (version) DO NOTHING;
