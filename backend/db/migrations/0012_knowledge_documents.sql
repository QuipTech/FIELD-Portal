-- Section 3b: documents/document_versions — versioned file storage with
-- an ingestion state machine (pending -> parsing -> chunking -> embedding
-- -> ready, or failed).

CREATE TABLE IF NOT EXISTS documents (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES tenants(id),
  knowledge_item_id   uuid NOT NULL REFERENCES knowledge_items(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  row_version         integer NOT NULL DEFAULT 1,
  deleted_at          timestamptz
);

CREATE INDEX IF NOT EXISTS idx_documents_tenant_id ON documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_documents_knowledge_item_id ON documents(knowledge_item_id);

DROP TRIGGER IF EXISTS trg_documents_bump_row_version ON documents;
CREATE TRIGGER trg_documents_bump_row_version
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION bump_row_version();

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS documents_select ON documents;
CREATE POLICY documents_select ON documents
  FOR SELECT USING (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS documents_insert ON documents;
CREATE POLICY documents_insert ON documents
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS documents_update ON documents;
CREATE POLICY documents_update ON documents
  FOR UPDATE USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE TABLE IF NOT EXISTS document_versions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL REFERENCES tenants(id),
  document_id        uuid NOT NULL REFERENCES documents(id),
  file_url           varchar NOT NULL,
  version_number     integer NOT NULL,
  uploaded_by        uuid NOT NULL REFERENCES users(id),
  ingestion_status   varchar NOT NULL DEFAULT 'pending'
                       CHECK (ingestion_status IN ('pending', 'parsing', 'chunking', 'embedding', 'ready', 'failed')),
  ingested_at        timestamptz,
  content_sha256     varchar,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  row_version        integer NOT NULL DEFAULT 1,
  UNIQUE (document_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_document_versions_tenant_id ON document_versions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_document_versions_document_id ON document_versions(document_id);
-- content_sha256 lookups skip re-processing an identical re-upload.
CREATE INDEX IF NOT EXISTS idx_document_versions_content_sha256 ON document_versions(content_sha256);

DROP TRIGGER IF EXISTS trg_document_versions_bump_row_version ON document_versions;
CREATE TRIGGER trg_document_versions_bump_row_version
  BEFORE UPDATE ON document_versions
  FOR EACH ROW EXECUTE FUNCTION bump_row_version();

ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_versions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS document_versions_select ON document_versions;
CREATE POLICY document_versions_select ON document_versions
  FOR SELECT USING (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS document_versions_insert ON document_versions;
CREATE POLICY document_versions_insert ON document_versions
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS document_versions_update ON document_versions;
CREATE POLICY document_versions_update ON document_versions
  FOR UPDATE USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

INSERT INTO schema_migrations (version)
VALUES ('0012_knowledge_documents')
ON CONFLICT (version) DO NOTHING;
