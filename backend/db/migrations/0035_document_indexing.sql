-- Section 3h: the indexing pipeline (extract → chunk → embed). States map
-- onto the existing columns rather than a parallel table:
--   queued        document_versions.ingestion_status = 'pending'
--   indexing      'parsing' | 'chunking' | 'embedding' (+ indexing_progress)
--   failed        'failed' (+ error_message)
--   needs_review  'ready' and knowledge_items.status = 'review'
--   live          'ready' and knowledge_items.status = 'published'
--   archived      knowledge_items.status = 'archived'

ALTER TABLE knowledge_items ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES users(id);
ALTER TABLE knowledge_items ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
-- Why a bulletin/policy was rejected.
ALTER TABLE knowledge_items ADD COLUMN IF NOT EXISTS review_note text;

ALTER TABLE knowledge_items DROP CONSTRAINT IF EXISTS knowledge_items_type_check;
ALTER TABLE knowledge_items ADD CONSTRAINT knowledge_items_type_check
  CHECK (type IN ('document', 'known_issue', 'troubleshooting_guide', 'bulletin',
                  'resolution', 'manual', 'procedure', 'policy', 'parts_book'));

ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS indexing_progress smallint NOT NULL DEFAULT 0;
ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS error_message text;
-- Lets a restarted worker reclaim a job that died mid-run.
ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS indexing_started_at timestamptz;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'document_versions_indexing_progress_range') THEN
    ALTER TABLE document_versions ADD CONSTRAINT document_versions_indexing_progress_range
      CHECK (indexing_progress BETWEEN 0 AND 100);
  END IF;
END $$;

-- The version AI search uses. Stays on the previous version while a new
-- one is queued, indexing or awaiting review, so a live document never
-- drops out of search during an update.
ALTER TABLE documents ADD COLUMN IF NOT EXISTS live_version_id uuid REFERENCES document_versions(id);

-- Shared-library chunks have no tenant, like their documents (0030).
ALTER TABLE document_chunks ALTER COLUMN tenant_id DROP NOT NULL;
DROP POLICY IF EXISTS document_chunks_select ON document_chunks;
CREATE POLICY document_chunks_select ON document_chunks
  FOR SELECT USING (tenant_id IS NULL OR tenant_id = current_tenant_id());
CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id ON document_chunks(document_id);

-- Machine models (machine library) a document mentions, found while
-- indexing. tenant_id follows the knowledge item (NULL = shared).
CREATE TABLE IF NOT EXISTS knowledge_item_machine_models (
  knowledge_item_id  uuid NOT NULL REFERENCES knowledge_items(id),
  machine_model_id   uuid NOT NULL REFERENCES machine_models(id),
  tenant_id          uuid REFERENCES tenants(id),
  mention_count      integer NOT NULL DEFAULT 1,
  created_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (knowledge_item_id, machine_model_id)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_item_machine_models_model
  ON knowledge_item_machine_models(machine_model_id);

ALTER TABLE knowledge_item_machine_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_item_machine_models FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS knowledge_item_machine_models_select ON knowledge_item_machine_models;
CREATE POLICY knowledge_item_machine_models_select ON knowledge_item_machine_models
  FOR SELECT USING (tenant_id IS NULL OR tenant_id = current_tenant_id());

INSERT INTO schema_migrations (version)
VALUES ('0035_document_indexing')
ON CONFLICT (version) DO NOTHING;
