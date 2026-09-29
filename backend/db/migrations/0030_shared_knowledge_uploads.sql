-- Section 3f: the shared knowledge library uploaded from the admin
-- portal. Files live in S3; the database keeps only metadata and the S3
-- location. A knowledge item with tenant_id IS NULL is QuipTech's shared
-- library, readable by every organisation (like system roles in 0004).
--
-- Writes to shared rows can't pass the per-tenant RLS insert/update
-- policies, so — like the admin role functions (0029) — they go through
-- SECURITY DEFINER functions callable only by field_app. The backend's
-- Owner-only guard is what restricts them; never call them from an
-- unguarded route. Reads need no function: the select policies below
-- already let every tenant see shared rows.

ALTER TABLE knowledge_items ALTER COLUMN tenant_id DROP NOT NULL;
ALTER TABLE documents ALTER COLUMN tenant_id DROP NOT NULL;
ALTER TABLE document_versions ALTER COLUMN tenant_id DROP NOT NULL;

DROP POLICY IF EXISTS knowledge_items_select ON knowledge_items;
CREATE POLICY knowledge_items_select ON knowledge_items
  FOR SELECT USING (tenant_id IS NULL OR tenant_id = current_tenant_id());
DROP POLICY IF EXISTS documents_select ON documents;
CREATE POLICY documents_select ON documents
  FOR SELECT USING (tenant_id IS NULL OR tenant_id = current_tenant_id());
DROP POLICY IF EXISTS document_versions_select ON document_versions;
CREATE POLICY document_versions_select ON document_versions
  FOR SELECT USING (tenant_id IS NULL OR tenant_id = current_tenant_id());

-- The portal's document types (Manual, Procedure) alongside the originals.
ALTER TABLE knowledge_items DROP CONSTRAINT IF EXISTS knowledge_items_type_check;
ALTER TABLE knowledge_items ADD CONSTRAINT knowledge_items_type_check
  CHECK (type IN ('document', 'known_issue', 'troubleshooting_guide',
                  'bulletin', 'resolution', 'manual', 'procedure'));

-- 'uploading': the row exists but the browser hasn't finished putting the
-- file in S3 yet. The ingestion pipeline only picks up 'pending'.
ALTER TABLE document_versions DROP CONSTRAINT IF EXISTS document_versions_ingestion_status_check;
ALTER TABLE document_versions ADD CONSTRAINT document_versions_ingestion_status_check
  CHECK (ingestion_status IN ('uploading', 'pending', 'parsing', 'chunking',
                              'embedding', 'ready', 'failed'));

-- file_url keeps the full s3://bucket/key for humans; bucket + key are
-- stored separately so code never parses a URL.
ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS storage_bucket varchar;
ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS storage_key varchar;
ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS file_name varchar;
ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS content_type varchar;
ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS size_bytes bigint;
-- Filled in by ingestion once the file has been parsed.
ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS page_count integer;

-- Ids come from the backend, which needs them to build the S3 key before
-- it signs the upload URL.
CREATE OR REPLACE FUNCTION admin_create_knowledge_upload(
  p_item_id       uuid,
  p_document_id   uuid,
  p_version_id    uuid,
  p_title         varchar,
  p_type          varchar,
  p_user_id       uuid,
  p_file_name     varchar,
  p_content_type  varchar,
  p_size_bytes    bigint,
  p_bucket        varchar,
  p_key           varchar
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO knowledge_items (id, tenant_id, title, type, status, source_type, created_by)
  VALUES (p_item_id, NULL, p_title, p_type, 'draft', 'internal', p_user_id);

  INSERT INTO documents (id, tenant_id, knowledge_item_id)
  VALUES (p_document_id, NULL, p_item_id);

  INSERT INTO document_versions (
    id, tenant_id, document_id, file_url, version_number, uploaded_by,
    ingestion_status, storage_bucket, storage_key, file_name, content_type,
    size_bytes
  )
  VALUES (
    p_version_id, NULL, p_document_id, 's3://' || p_bucket || '/' || p_key, 1,
    p_user_id, 'uploading', p_bucket, p_key, p_file_name, p_content_type,
    p_size_bytes
  );
END;
$$;

-- 'uploading' -> 'pending' (queued for ingestion) or 'failed'. False when
-- the version isn't a shared one still waiting for its upload.
CREATE OR REPLACE FUNCTION admin_finish_knowledge_upload(
  p_version_id  uuid,
  p_succeeded   boolean
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH updated AS (
    UPDATE document_versions
    SET ingestion_status = CASE WHEN p_succeeded THEN 'pending' ELSE 'failed' END
    WHERE id = p_version_id AND tenant_id IS NULL AND ingestion_status = 'uploading'
    RETURNING 1
  )
  SELECT EXISTS (SELECT 1 FROM updated);
$$;

-- Soft delete; the S3 object is kept (versioned buckets / lifecycle rules
-- decide when files really go). False when there's no such shared item.
CREATE OR REPLACE FUNCTION admin_delete_knowledge_item(p_item_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE knowledge_items SET deleted_at = now()
  WHERE id = p_item_id AND tenant_id IS NULL AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  UPDATE documents SET deleted_at = now()
  WHERE knowledge_item_id = p_item_id AND deleted_at IS NULL;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION admin_create_knowledge_upload(uuid, uuid, uuid, varchar, varchar, uuid, varchar, varchar, bigint, varchar, varchar) FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_finish_knowledge_upload(uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_delete_knowledge_item(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_create_knowledge_upload(uuid, uuid, uuid, varchar, varchar, uuid, varchar, varchar, bigint, varchar, varchar) TO field_app;
GRANT EXECUTE ON FUNCTION admin_finish_knowledge_upload(uuid, boolean) TO field_app;
GRANT EXECUTE ON FUNCTION admin_delete_knowledge_item(uuid) TO field_app;

INSERT INTO schema_migrations (version)
VALUES ('0030_shared_knowledge_uploads')
ON CONFLICT (version) DO NOTHING;
