-- Knowledge items with their latest document version, for the Knowledge
-- screens (portal and admin). SECURITY DEFINER because the Owner lists
-- every organisation's documents, which RLS hides from field_app when no
-- app.tenant_id is set — the admin overview (0058) already counted them,
-- so the Knowledge screen showed none while the overview showed several.
-- Visibility stays explicit in the WHERE clause: the shared library
-- (tenant_id IS NULL), plus p_tenant_id's own documents, or every
-- organisation's when p_all_tenants (the Owner).

CREATE OR REPLACE FUNCTION list_knowledge_documents(
  p_item_id     uuid,
  p_search      varchar,
  p_type        varchar,
  p_limit       integer,
  p_offset      integer,
  p_tenant_id   uuid,
  p_all_tenants boolean
)
RETURNS TABLE (
  id                    uuid,
  tenant_id             uuid,
  organisation_name     varchar,
  title                 varchar,
  type                  varchar,
  status                varchar,
  created_at            timestamptz,
  review_note           text,
  document_id           uuid,
  version_id            uuid,
  version_number        integer,
  indexing_progress     smallint,
  error_message         text,
  file_name             varchar,
  content_type          varchar,
  size_bytes            bigint,
  page_count            integer,
  page_count_checked_at timestamptz,
  ingestion_status      varchar,
  ingested_at           timestamptz,
  storage_bucket        varchar,
  storage_key           varchar,
  total_count           bigint
)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT ki.id, ki.tenant_id, t.name, ki.title, ki.type, ki.status, ki.created_at,
         ki.review_note, d.id,
         dv.id, dv.version_number, dv.indexing_progress, dv.error_message, dv.file_name, dv.content_type, dv.size_bytes,
         dv.page_count, dv.page_count_checked_at, dv.ingestion_status, dv.ingested_at,
         dv.storage_bucket, dv.storage_key,
         count(*) OVER ()
  FROM knowledge_items ki
  LEFT JOIN tenants t ON t.id = ki.tenant_id
  JOIN documents d ON d.knowledge_item_id = ki.id AND d.deleted_at IS NULL
  JOIN LATERAL (
    SELECT * FROM document_versions v
    WHERE v.document_id = d.id
    ORDER BY v.version_number DESC
    LIMIT 1
  ) dv ON true
  WHERE ki.deleted_at IS NULL
    AND (ki.tenant_id IS NULL OR (p_tenant_id IS NOT NULL AND ki.tenant_id = p_tenant_id)
         OR p_all_tenants)
    AND (p_item_id IS NULL OR ki.id = p_item_id)
    AND (p_search IS NULL
         OR ki.title ILIKE '%' || p_search || '%'
         OR dv.file_name ILIKE '%' || p_search || '%')
    AND (p_type IS NULL OR ki.type = p_type)
  ORDER BY ki.created_at DESC, ki.id
  LIMIT p_limit OFFSET p_offset;
$$;

REVOKE ALL ON FUNCTION list_knowledge_documents(uuid, varchar, varchar, integer, integer, uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION list_knowledge_documents(uuid, varchar, varchar, integer, integer, uuid, boolean) TO field_app;

INSERT INTO schema_migrations (version)
VALUES ('0078_list_knowledge_documents')
ON CONFLICT (version) DO NOTHING;
