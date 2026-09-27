-- Section 3h (cont.): new document versions and permanent deletion, plus
-- grants for 0037. SECURITY DEFINER for the same reason as 0037.

-- The next version of a document. p_is_uploaded: the file is already in
-- S3 (backend upload → queued straight away) or the browser still has to
-- PUT it ('uploading', finished by admin_finish_knowledge_upload). The
-- previous version and its chunks stay; the live one stays searchable
-- until this one goes live. Returns the new version number, or NULL when
-- there's no such document.
CREATE OR REPLACE FUNCTION create_document_version(
  p_item_id uuid, p_version_id uuid, p_user_id uuid, p_bucket varchar, p_key varchar,
  p_file_name varchar, p_content_type varchar, p_size_bytes bigint, p_is_uploaded boolean
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_document_id uuid;
  v_tenant_id uuid;
  v_number integer;
BEGIN
  SELECT d.id, ki.tenant_id INTO v_document_id, v_tenant_id FROM knowledge_items ki
    JOIN documents d ON d.knowledge_item_id = ki.id AND d.deleted_at IS NULL
    WHERE ki.id = p_item_id AND ki.deleted_at IS NULL FOR UPDATE OF d;
  IF v_document_id IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT COALESCE(max(version_number), 0) + 1 INTO v_number
    FROM document_versions WHERE document_id = v_document_id;

  INSERT INTO document_versions (
    id, tenant_id, document_id, file_url, version_number, uploaded_by, ingestion_status,
    storage_bucket, storage_key, file_name, content_type, size_bytes)
  VALUES (
    p_version_id, v_tenant_id, v_document_id, 's3://' || p_bucket || '/' || p_key, v_number,
    p_user_id, CASE WHEN p_is_uploaded THEN 'pending' ELSE 'uploading' END,
    p_bucket, p_key, p_file_name, p_content_type, p_size_bytes);
  RETURN v_number;
END;
$$;

-- Removes a document for good: chunks (and AI citations pointing at them),
-- machine-model links, review/feedback rows, every version and the item.
-- Returns every version's S3 key so the backend can delete the files.
CREATE OR REPLACE FUNCTION delete_knowledge_item_permanently(p_item_id uuid)
RETURNS TABLE (storage_key varchar)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_document_ids uuid[];
BEGIN
  SELECT coalesce(array_agg(d.id), '{}') INTO v_document_ids
    FROM documents d WHERE d.knowledge_item_id = p_item_id;

  RETURN QUERY SELECT dv.storage_key FROM document_versions dv
    WHERE dv.document_id = ANY (v_document_ids) AND dv.storage_key IS NOT NULL;

  DELETE FROM ai_source_references WHERE chunk_id IN
    (SELECT c.id FROM document_chunks c WHERE c.document_id = ANY (v_document_ids));
  DELETE FROM document_chunks c WHERE c.document_id = ANY (v_document_ids);
  DELETE FROM knowledge_item_machine_models WHERE knowledge_item_id = p_item_id;
  DELETE FROM review_queue_items WHERE knowledge_item_id = p_item_id;
  DELETE FROM knowledge_feedback WHERE knowledge_item_id = p_item_id;
  UPDATE documents SET live_version_id = NULL WHERE id = ANY (v_document_ids);
  DELETE FROM document_versions WHERE document_id = ANY (v_document_ids);
  DELETE FROM documents WHERE id = ANY (v_document_ids);
  DELETE FROM knowledge_items WHERE id = p_item_id;
END;
$$;

REVOKE ALL ON FUNCTION complete_indexing(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION fail_indexing(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION transition_knowledge_item(uuid, varchar, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION create_document_version(uuid, uuid, uuid, varchar, varchar, varchar, varchar, bigint, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION delete_knowledge_item_permanently(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION complete_indexing(uuid, integer) TO field_app;
GRANT EXECUTE ON FUNCTION fail_indexing(uuid, text) TO field_app;
GRANT EXECUTE ON FUNCTION transition_knowledge_item(uuid, varchar, uuid, text) TO field_app;
GRANT EXECUTE ON FUNCTION create_document_version(uuid, uuid, uuid, varchar, varchar, varchar, varchar, bigint, boolean) TO field_app;
GRANT EXECUTE ON FUNCTION delete_knowledge_item_permanently(uuid) TO field_app;

INSERT INTO schema_migrations (version)
VALUES ('0038_document_versions_and_deletion')
ON CONFLICT (version) DO NOTHING;
