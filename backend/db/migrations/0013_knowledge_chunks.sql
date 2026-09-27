-- Section 3c: document_chunks — powers AI semantic search. Citations are
-- version-specific (document_version_id, not just document_id) with real
-- anchors (page/section + character offsets) so a citation survives
-- re-ingestion of a later version.

CREATE TABLE IF NOT EXISTS document_chunks (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                uuid NOT NULL REFERENCES tenants(id),
  document_id              uuid NOT NULL REFERENCES documents(id),
  document_version_id      uuid NOT NULL REFERENCES document_versions(id),
  chunk_text               text NOT NULL,
  embedding                vector(1024) NOT NULL,
  page_number              integer,
  section_heading          varchar,
  char_start               integer,
  char_end                 integer,
  chunk_index              integer NOT NULL,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  row_version               integer NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_document_chunks_tenant_id ON document_chunks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_document_version_id ON document_chunks(document_version_id);

-- Titan Text Embeddings V2 on Bedrock, dimension fixed at 1024.
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding_hnsw
  ON document_chunks USING hnsw (embedding vector_cosine_ops);

DROP TRIGGER IF EXISTS trg_document_chunks_bump_row_version ON document_chunks;
CREATE TRIGGER trg_document_chunks_bump_row_version
  BEFORE UPDATE ON document_chunks
  FOR EACH ROW EXECUTE FUNCTION bump_row_version();

ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS document_chunks_select ON document_chunks;
CREATE POLICY document_chunks_select ON document_chunks
  FOR SELECT USING (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS document_chunks_insert ON document_chunks;
CREATE POLICY document_chunks_insert ON document_chunks
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());

INSERT INTO schema_migrations (version)
VALUES ('0013_knowledge_chunks')
ON CONFLICT (version) DO NOTHING;
