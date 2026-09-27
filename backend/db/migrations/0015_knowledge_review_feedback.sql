-- Section 3e: review_queue_items (approval workflow queue for knowledge
-- submissions) and knowledge_feedback (technician feedback on published
-- knowledge).

CREATE TABLE IF NOT EXISTS review_queue_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES tenants(id),
  knowledge_item_id   uuid NOT NULL REFERENCES knowledge_items(id),
  submitted_by        uuid NOT NULL REFERENCES users(id),
  reviewed_by         uuid REFERENCES users(id),
  status              varchar NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  row_version         integer NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_review_queue_items_tenant_id ON review_queue_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_review_queue_items_knowledge_item_id ON review_queue_items(knowledge_item_id);

DROP TRIGGER IF EXISTS trg_review_queue_items_bump_row_version ON review_queue_items;
CREATE TRIGGER trg_review_queue_items_bump_row_version
  BEFORE UPDATE ON review_queue_items
  FOR EACH ROW EXECUTE FUNCTION bump_row_version();

ALTER TABLE review_queue_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_queue_items FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS review_queue_items_select ON review_queue_items;
CREATE POLICY review_queue_items_select ON review_queue_items
  FOR SELECT USING (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS review_queue_items_insert ON review_queue_items;
CREATE POLICY review_queue_items_insert ON review_queue_items
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS review_queue_items_update ON review_queue_items;
CREATE POLICY review_queue_items_update ON review_queue_items
  FOR UPDATE USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE TABLE IF NOT EXISTS knowledge_feedback (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES tenants(id),
  knowledge_item_id   uuid NOT NULL REFERENCES knowledge_items(id),
  user_id             uuid NOT NULL REFERENCES users(id),
  rating              varchar NOT NULL,
  comment             text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  row_version         integer NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_knowledge_feedback_tenant_id ON knowledge_feedback(tenant_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_feedback_knowledge_item_id ON knowledge_feedback(knowledge_item_id);

DROP TRIGGER IF EXISTS trg_knowledge_feedback_bump_row_version ON knowledge_feedback;
CREATE TRIGGER trg_knowledge_feedback_bump_row_version
  BEFORE UPDATE ON knowledge_feedback
  FOR EACH ROW EXECUTE FUNCTION bump_row_version();

ALTER TABLE knowledge_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_feedback FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS knowledge_feedback_select ON knowledge_feedback;
CREATE POLICY knowledge_feedback_select ON knowledge_feedback
  FOR SELECT USING (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS knowledge_feedback_insert ON knowledge_feedback;
CREATE POLICY knowledge_feedback_insert ON knowledge_feedback
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());

INSERT INTO schema_migrations (version)
VALUES ('0015_knowledge_review_feedback')
ON CONFLICT (version) DO NOTHING;
