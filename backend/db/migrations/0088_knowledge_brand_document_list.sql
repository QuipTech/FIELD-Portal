BEGIN;
DROP FUNCTION IF EXISTS list_knowledge_documents(uuid,varchar,varchar,integer,integer,uuid,boolean);
CREATE OR REPLACE FUNCTION list_knowledge_documents(
  p_item_id     uuid,
  p_search      varchar,
  p_type        varchar,
  p_limit       integer,
  p_offset      integer,
  p_tenant_id   uuid,
  p_all_tenants boolean,
  p_user_id uuid DEFAULT NULL,
  p_brand uuid DEFAULT NULL,p_category uuid DEFAULT NULL,p_model uuid DEFAULT NULL,p_status varchar DEFAULT NULL
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
  brand_id uuid, category_id uuid, document_type varchar, machine_model_ids uuid[],
  total_count           bigint
)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT ki.id, ki.tenant_id, t.name, ki.title, ki.type, ki.status, ki.created_at,
         ki.review_note, d.id,
         dv.id, dv.version_number, dv.indexing_progress, dv.error_message, dv.file_name, dv.content_type, dv.size_bytes,
         dv.page_count, dv.page_count_checked_at, dv.ingestion_status, dv.ingested_at,
         dv.storage_bucket, dv.storage_key,
         d.brand_id,d.category_id,d.document_type,
         ARRAY(SELECT machine_model_id FROM document_machine_models WHERE document_id=d.id),
         count(*) OVER ()
  FROM knowledge_items ki
  LEFT JOIN tenants t ON t.id = ki.tenant_id
  JOIN documents d ON d.knowledge_item_id = ki.id AND d.deleted_at IS NULL
  JOIN LATERAL (
    SELECT * FROM document_versions v
    WHERE v.document_id = d.id
      AND (p_all_tenants OR v.id=d.live_version_id OR (d.tenant_id=p_tenant_id AND user_has_permission(p_user_id,'knowledge.submit')))
    ORDER BY v.version_number DESC
    LIMIT 1
  ) dv ON true
  WHERE ki.deleted_at IS NULL
    AND (ki.tenant_id IS NULL OR (p_tenant_id IS NOT NULL AND ki.tenant_id = p_tenant_id)
         OR p_all_tenants)
    AND (p_all_tenants OR knowledge_can_read_document(d.id,p_tenant_id,p_user_id))
    AND (p_brand IS NULL OR d.brand_id=p_brand)
    AND (p_category IS NULL OR d.category_id=p_category)
    AND (p_model IS NULL OR EXISTS(SELECT 1 FROM knowledge_item_machine_models km WHERE km.knowledge_item_id=ki.id AND km.machine_model_id=p_model))
    AND (p_status IS NULL OR CASE p_status WHEN 'needs_review' THEN ki.status='review' WHEN 'published' THEN d.live_version_id IS NOT NULL AND ki.status NOT IN ('archived','withdrawn') ELSE ki.status=p_status END)
    AND (p_item_id IS NULL OR ki.id = p_item_id)
    AND (p_search IS NULL
         OR ki.title ILIKE '%' || p_search || '%'
         OR dv.file_name ILIKE '%' || p_search || '%')
    AND (p_type IS NULL OR ki.type = p_type)
  ORDER BY ki.created_at DESC, ki.id
  LIMIT p_limit OFFSET p_offset;
$$;

REVOKE ALL ON FUNCTION list_knowledge_documents(uuid, varchar, varchar, integer, integer, uuid, boolean, uuid, uuid, uuid, uuid, varchar) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION list_knowledge_documents(uuid, varchar, varchar, integer, integer, uuid, boolean, uuid, uuid, uuid, uuid, varchar) TO field_app;

INSERT INTO schema_migrations (version)
VALUES ('0088_knowledge_brand_document_list')
ON CONFLICT (version) DO NOTHING;

COMMIT;
