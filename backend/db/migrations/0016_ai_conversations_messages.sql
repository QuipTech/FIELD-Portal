-- Section 4a: ai_conversations, ai_messages. Also closes the forward
-- reference left open in 0014: resolution_records.conversation_id now
-- has somewhere to point.

CREATE TABLE IF NOT EXISTS ai_conversations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id),
  user_id      uuid NOT NULL REFERENCES users(id),
  machine_id   uuid REFERENCES machines(id),
  title        varchar,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  row_version  integer NOT NULL DEFAULT 1,
  deleted_at   timestamptz
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_tenant_id ON ai_conversations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_id ON ai_conversations(user_id);

DROP TRIGGER IF EXISTS trg_ai_conversations_bump_row_version ON ai_conversations;
CREATE TRIGGER trg_ai_conversations_bump_row_version
  BEFORE UPDATE ON ai_conversations
  FOR EACH ROW EXECUTE FUNCTION bump_row_version();

ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_conversations_select ON ai_conversations;
CREATE POLICY ai_conversations_select ON ai_conversations
  FOR SELECT USING (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS ai_conversations_insert ON ai_conversations;
CREATE POLICY ai_conversations_insert ON ai_conversations
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS ai_conversations_update ON ai_conversations;
CREATE POLICY ai_conversations_update ON ai_conversations
  FOR UPDATE USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_resolution_records_conversation'
  ) THEN
    ALTER TABLE resolution_records
      ADD CONSTRAINT fk_resolution_records_conversation
      FOREIGN KEY (conversation_id) REFERENCES ai_conversations(id);
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS ai_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  conversation_id uuid NOT NULL REFERENCES ai_conversations(id),
  role            varchar NOT NULL CHECK (role IN ('user', 'assistant')),
  content         text NOT NULL,
  model_used      varchar,
  prompt_version  varchar,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  row_version     integer NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_ai_messages_tenant_id ON ai_messages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation_id ON ai_messages(conversation_id);

ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_messages FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_messages_select ON ai_messages;
CREATE POLICY ai_messages_select ON ai_messages
  FOR SELECT USING (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS ai_messages_insert ON ai_messages;
CREATE POLICY ai_messages_insert ON ai_messages
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());

INSERT INTO schema_migrations (version)
VALUES ('0016_ai_conversations_messages')
ON CONFLICT (version) DO NOTHING;
