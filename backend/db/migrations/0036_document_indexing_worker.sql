-- Section 3h (cont.): functions for the backend's indexing worker. It runs
-- outside any request, across shared and tenant documents, so each step is
-- SECURITY DEFINER and callable only by field_app. Every state transition
-- is written to audit_logs here, under the document's organisation (the
-- uploader's for the shared library), with no user: the worker did it.

CREATE OR REPLACE FUNCTION log_indexing_transition(
  p_version_id uuid, p_from varchar, p_to varchar, p_detail text
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, metadata)
  SELECT COALESCE(ki.tenant_id, uploader.tenant_id), NULL, 'update', 'knowledge_item', ki.id,
         jsonb_build_object('versionId', dv.id, 'from', p_from, 'to', p_to, 'detail', p_detail)
  FROM document_versions dv
  JOIN documents d ON d.id = dv.document_id
  JOIN knowledge_items ki ON ki.id = d.knowledge_item_id
  LEFT JOIN users uploader ON uploader.id = dv.uploaded_by
  WHERE dv.id = p_version_id
    AND COALESCE(ki.tenant_id, uploader.tenant_id) IS NOT NULL;
$$;

-- Takes the oldest queued version (or one whose worker died more than
-- p_stale_minutes ago). SKIP LOCKED lets several API instances run workers
-- without ever taking the same job. Leftover chunks from a failed or
-- interrupted run are cleared so indexing starts clean.
CREATE OR REPLACE FUNCTION claim_next_indexing_job(p_stale_minutes integer)
RETURNS TABLE (
  version_id uuid, document_id uuid, knowledge_item_id uuid, tenant_id uuid,
  item_type varchar, title varchar, storage_key varchar, content_type varchar,
  size_bytes bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT dv.id INTO v_id
  FROM document_versions dv
  JOIN documents d ON d.id = dv.document_id AND d.deleted_at IS NULL
  JOIN knowledge_items ki ON ki.id = d.knowledge_item_id AND ki.deleted_at IS NULL
  WHERE dv.storage_key IS NOT NULL
    AND (dv.ingestion_status = 'pending'
         OR (dv.ingestion_status IN ('parsing', 'chunking', 'embedding')
             AND dv.indexing_started_at < now() - make_interval(mins => p_stale_minutes)))
  ORDER BY dv.created_at
  FOR UPDATE OF dv SKIP LOCKED
  LIMIT 1;
  IF v_id IS NULL THEN
    RETURN;
  END IF;

  DELETE FROM ai_source_references
    WHERE chunk_id IN (SELECT c.id FROM document_chunks c WHERE c.document_version_id = v_id);
  DELETE FROM document_chunks c WHERE c.document_version_id = v_id;
  UPDATE document_versions
    SET ingestion_status = 'parsing', indexing_progress = 0, error_message = NULL,
        indexing_started_at = now()
    WHERE id = v_id;
  PERFORM log_indexing_transition(v_id, 'queued', 'indexing', NULL);

  RETURN QUERY
    SELECT dv.id, dv.document_id, d.knowledge_item_id, dv.tenant_id, ki.type, ki.title,
           dv.storage_key, dv.content_type, dv.size_bytes
    FROM document_versions dv
    JOIN documents d ON d.id = dv.document_id
    JOIN knowledge_items ki ON ki.id = d.knowledge_item_id
    WHERE dv.id = v_id;
END;
$$;

-- False when the job no longer exists or isn't indexing (deleted or reset
-- meanwhile) — the worker then stops.
CREATE OR REPLACE FUNCTION set_indexing_progress(
  p_version_id uuid, p_stage varchar, p_progress integer
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH updated AS (
    UPDATE document_versions
    SET ingestion_status = p_stage, indexing_progress = LEAST(GREATEST(p_progress, 0), 99),
        indexing_started_at = now()
    WHERE id = p_version_id
      AND ingestion_status IN ('parsing', 'chunking', 'embedding')
      AND p_stage IN ('parsing', 'chunking', 'embedding')
    RETURNING 1
  )
  SELECT EXISTS (SELECT 1 FROM updated);
$$;

-- Embeddings arrive as pgvector text literals ('[0.1,0.2,…]').
CREATE OR REPLACE FUNCTION insert_document_chunks(
  p_version_id uuid, p_first_index integer, p_pages integer[], p_headings text[],
  p_contents text[], p_embeddings text[]
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO document_chunks
    (tenant_id, document_id, document_version_id, chunk_text, embedding,
     page_number, section_heading, chunk_index)
  SELECT dv.tenant_id, dv.document_id, dv.id, u.content, u.embedding::vector,
         u.page, u.heading, p_first_index + u.ord::integer - 1
  FROM document_versions dv,
       unnest(p_pages, p_headings, p_contents, p_embeddings)
         WITH ORDINALITY AS u(page, heading, content, embedding, ord)
  WHERE dv.id = p_version_id
    AND dv.ingestion_status IN ('parsing', 'chunking', 'embedding');
$$;

-- Replaces the document's links to machine-library models.
CREATE OR REPLACE FUNCTION link_document_machine_models(
  p_item_id uuid, p_model_ids uuid[], p_counts integer[]
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM knowledge_item_machine_models WHERE knowledge_item_id = p_item_id;
  INSERT INTO knowledge_item_machine_models (knowledge_item_id, machine_model_id, tenant_id, mention_count)
  SELECT ki.id, u.model_id, ki.tenant_id, u.mentions
  FROM knowledge_items ki, unnest(p_model_ids, p_counts) AS u(model_id, mentions)
  WHERE ki.id = p_item_id;
$$;

-- log_indexing_transition is internal: only these functions call it.
REVOKE ALL ON FUNCTION log_indexing_transition(uuid, varchar, varchar, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION claim_next_indexing_job(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION set_indexing_progress(uuid, varchar, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION insert_document_chunks(uuid, integer, integer[], text[], text[], text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION link_document_machine_models(uuid, uuid[], integer[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION claim_next_indexing_job(integer) TO field_app;
GRANT EXECUTE ON FUNCTION set_indexing_progress(uuid, varchar, integer) TO field_app;
GRANT EXECUTE ON FUNCTION insert_document_chunks(uuid, integer, integer[], text[], text[], text[]) TO field_app;
GRANT EXECUTE ON FUNCTION link_document_machine_models(uuid, uuid[], integer[]) TO field_app;

INSERT INTO schema_migrations (version)
VALUES ('0036_document_indexing_worker')
ON CONFLICT (version) DO NOTHING;
