-- Section 3g: page counts for uploaded documents. A background job in the
-- backend reads each newly uploaded file from S3 and records its page
-- count. It runs outside any request, for shared and tenant documents
-- alike, so both steps are SECURITY DEFINER functions callable only by
-- field_app (see 0028 for the pattern). Neither exposes document content.

-- Set on every counting attempt, even when no count could be found (a DOCX
-- that doesn't record pages, a PDF too large to parse), so each file is
-- tried once instead of on every sweep.
ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS page_count_checked_at timestamptz;

-- Uploaded (not 'uploading'), not failed, and not tried yet. .doc files
-- are skipped: the backend can't count their pages.
CREATE OR REPLACE FUNCTION list_document_versions_missing_page_count(p_limit integer)
RETURNS TABLE (
  version_id    uuid,
  storage_key   varchar,
  content_type  varchar,
  size_bytes    bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT dv.id, dv.storage_key, dv.content_type, dv.size_bytes
  FROM document_versions dv
  JOIN documents d ON d.id = dv.document_id AND d.deleted_at IS NULL
  WHERE dv.page_count_checked_at IS NULL
    AND dv.storage_key IS NOT NULL
    AND dv.ingestion_status NOT IN ('uploading', 'failed')
    AND dv.content_type IN (
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  ORDER BY dv.created_at
  LIMIT p_limit;
$$;

-- p_page_count NULL + p_unreadable true marks the file failed (corrupt or
-- not really a PDF/DOCX), which also takes it out of the list above.
CREATE OR REPLACE FUNCTION record_document_page_count(
  p_version_id  uuid,
  p_page_count  integer,
  p_unreadable  boolean
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE document_versions
  SET page_count = COALESCE(p_page_count, page_count),
      page_count_checked_at = now(),
      ingestion_status = CASE WHEN p_unreadable THEN 'failed' ELSE ingestion_status END
  WHERE id = p_version_id AND ingestion_status <> 'uploading';
$$;

REVOKE ALL ON FUNCTION list_document_versions_missing_page_count(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION record_document_page_count(uuid, integer, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION list_document_versions_missing_page_count(integer) TO field_app;
GRANT EXECUTE ON FUNCTION record_document_page_count(uuid, integer, boolean) TO field_app;

INSERT INTO schema_migrations (version)
VALUES ('0034_document_page_counts')
ON CONFLICT (version) DO NOTHING;
