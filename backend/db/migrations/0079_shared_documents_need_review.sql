-- Every shared-library document now waits for an Owner's approval after
-- indexing, whatever its type. 0037 only held back bulletins and policies,
-- so shared manuals, procedures and parts books went live unreviewed.
-- Organisation documents (tenant_id set) still go live straight away.

CREATE OR REPLACE FUNCTION complete_indexing(p_version_id uuid, p_page_count integer)
RETURNS varchar
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item knowledge_items%ROWTYPE;
  v_document_id uuid;
  v_state varchar;
BEGIN
  SELECT d.id INTO v_document_id FROM document_versions dv
    JOIN documents d ON d.id = dv.document_id
    WHERE dv.id = p_version_id AND dv.ingestion_status IN ('parsing', 'chunking', 'embedding')
    FOR UPDATE OF dv;
  IF v_document_id IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT ki.* INTO v_item FROM knowledge_items ki
    JOIN documents d ON d.knowledge_item_id = ki.id WHERE d.id = v_document_id FOR UPDATE OF ki;

  UPDATE document_versions
    SET ingestion_status = 'ready', indexing_progress = 100, ingested_at = now(),
        page_count = COALESCE(p_page_count, page_count), page_count_checked_at = now()
    WHERE id = p_version_id;

  IF v_item.tenant_id IS NULL THEN
    UPDATE knowledge_items SET status = 'review' WHERE id = v_item.id;
    v_state := 'needs_review';
  ELSE
    UPDATE knowledge_items SET status = 'published' WHERE id = v_item.id;
    UPDATE documents SET live_version_id = p_version_id WHERE id = v_document_id;
    v_state := 'live';
  END IF;
  PERFORM log_indexing_transition(p_version_id, 'indexing', v_state, NULL);
  RETURN v_state;
END;
$$;

REVOKE ALL ON FUNCTION complete_indexing(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION complete_indexing(uuid, integer) TO field_app;

INSERT INTO schema_migrations (version)
VALUES ('0079_shared_documents_need_review')
ON CONFLICT (version) DO NOTHING;
