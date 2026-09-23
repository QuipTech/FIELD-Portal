-- Section 4b: ai_source_references (chunk_id is now required, not
-- optional — it points to the exact chunk, not just the document) and
-- ai_feedback.

CREATE TABLE IF NOT EXISTS ai_source_references (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id),
  message_id       uuid NOT NULL REFERENCES ai_messages(id),
  chunk_id         uuid NOT NULL REFERENCES document_chunks(id),
  page_number      integer,
  section_heading  varchar,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_source_references_tenant_id ON ai_source_references(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_source_references_message_id ON ai_source_references(message_id);

ALTER TABLE ai_source_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_source_references FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_source_references_select ON ai_source_references;
CREATE POLICY ai_source_references_select ON ai_source_references
  FOR SELECT USING (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS ai_source_references_insert ON ai_source_references;
CREATE POLICY ai_source_references_insert ON ai_source_references
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());

CREATE TABLE IF NOT EXISTS ai_feedback (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id),
  message_id   uuid NOT NULL REFERENCES ai_messages(id),
  rating       varchar NOT NULL,
  comment      text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  row_version  integer NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_ai_feedback_tenant_id ON ai_feedback(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_message_id ON ai_feedback(message_id);

DROP TRIGGER IF EXISTS trg_ai_feedback_bump_row_version ON ai_feedback;
CREATE TRIGGER trg_ai_feedback_bump_row_version
  BEFORE UPDATE ON ai_feedback
  FOR EACH ROW EXECUTE FUNCTION bump_row_version();

ALTER TABLE ai_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_feedback FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_feedback_select ON ai_feedback;
CREATE POLICY ai_feedback_select ON ai_feedback
  FOR SELECT USING (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS ai_feedback_insert ON ai_feedback;
CREATE POLICY ai_feedback_insert ON ai_feedback
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());

INSERT INTO schema_migrations (version)
VALUES ('0017_ai_references_feedback')
ON CONFLICT (version) DO NOTHING;
