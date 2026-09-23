-- Section 4c: ai_review_items (admin review queue) and ai_escalations
-- (escalation tracking).

CREATE TABLE IF NOT EXISTS ai_review_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id),
  message_id   uuid NOT NULL REFERENCES ai_messages(id),
  status       varchar NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed')),
  reason       text,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  row_version  integer NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_ai_review_items_tenant_id ON ai_review_items(tenant_id);

DROP TRIGGER IF EXISTS trg_ai_review_items_bump_row_version ON ai_review_items;
CREATE TRIGGER trg_ai_review_items_bump_row_version
  BEFORE UPDATE ON ai_review_items
  FOR EACH ROW EXECUTE FUNCTION bump_row_version();

ALTER TABLE ai_review_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_review_items FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_review_items_select ON ai_review_items;
CREATE POLICY ai_review_items_select ON ai_review_items
  FOR SELECT USING (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS ai_review_items_insert ON ai_review_items;
CREATE POLICY ai_review_items_insert ON ai_review_items
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS ai_review_items_update ON ai_review_items;
CREATE POLICY ai_review_items_update ON ai_review_items
  FOR UPDATE USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE TABLE IF NOT EXISTS ai_escalations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id),
  conversation_id  uuid NOT NULL REFERENCES ai_conversations(id),
  escalated_by     uuid NOT NULL REFERENCES users(id),
  escalated_to     uuid REFERENCES users(id),
  status           varchar NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed')),
  reason           text,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  row_version      integer NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_ai_escalations_tenant_id ON ai_escalations(tenant_id);

DROP TRIGGER IF EXISTS trg_ai_escalations_bump_row_version ON ai_escalations;
CREATE TRIGGER trg_ai_escalations_bump_row_version
  BEFORE UPDATE ON ai_escalations
  FOR EACH ROW EXECUTE FUNCTION bump_row_version();

ALTER TABLE ai_escalations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_escalations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_escalations_select ON ai_escalations;
CREATE POLICY ai_escalations_select ON ai_escalations
  FOR SELECT USING (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS ai_escalations_insert ON ai_escalations;
CREATE POLICY ai_escalations_insert ON ai_escalations
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS ai_escalations_update ON ai_escalations;
CREATE POLICY ai_escalations_update ON ai_escalations
  FOR UPDATE USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

INSERT INTO schema_migrations (version)
VALUES ('0018_ai_review_escalations')
ON CONFLICT (version) DO NOTHING;
