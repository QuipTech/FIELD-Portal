-- Section 3h (cont.): end of indexing, admin review/lifecycle actions, new
-- versions and permanent deletion. SECURITY DEFINER because they also act
-- on shared-library rows (tenant_id IS NULL), which the per-tenant RLS
-- write policies can't reach. The backend checks who may call them.

-- Returns the new state: 'needs_review' for shared-library bulletins and
-- policies, otherwise 'live' (and the version becomes the searchable one).
-- NULL when the version isn't indexing any more.
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

  IF v_item.tenant_id IS NULL AND v_item.type IN ('bulletin', 'policy') THEN
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

CREATE OR REPLACE FUNCTION fail_indexing(p_version_id uuid, p_error text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE document_versions SET ingestion_status = 'failed', error_message = left(p_error, 1000)
    WHERE id = p_version_id AND ingestion_status IN ('parsing', 'chunking', 'embedding');
  IF FOUND THEN
    PERFORM log_indexing_transition(p_version_id, 'indexing', 'failed', left(p_error, 1000));
  END IF;
END;
$$;

-- approve (needs_review → live), reject (needs_review → archived, with a
-- note), archive (live → archived), retry (failed → queued). Returns 'ok',
-- 'not_found' or 'invalid_state'; the caller audits with the acting user.
CREATE OR REPLACE FUNCTION transition_knowledge_item(
  p_item_id uuid, p_action varchar, p_user_id uuid, p_note text
)
RETURNS varchar
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status varchar;
  v_document_id uuid;
  v_version document_versions%ROWTYPE;
BEGIN
  SELECT ki.status, d.id INTO v_status, v_document_id FROM knowledge_items ki
    JOIN documents d ON d.knowledge_item_id = ki.id AND d.deleted_at IS NULL
    WHERE ki.id = p_item_id AND ki.deleted_at IS NULL FOR UPDATE OF ki;
  IF v_document_id IS NULL THEN
    RETURN 'not_found';
  END IF;
  SELECT * INTO v_version FROM document_versions
    WHERE document_id = v_document_id ORDER BY version_number DESC LIMIT 1 FOR UPDATE;

  IF p_action = 'approve' AND v_status = 'review' AND v_version.ingestion_status = 'ready' THEN
    UPDATE knowledge_items SET status = 'published', reviewed_by = p_user_id, reviewed_at = now(),
      review_note = NULL WHERE id = p_item_id;
    UPDATE documents SET live_version_id = v_version.id WHERE id = v_document_id;
  ELSIF p_action = 'reject' AND v_status = 'review' THEN
    UPDATE knowledge_items SET status = 'archived', reviewed_by = p_user_id, reviewed_at = now(),
      review_note = p_note WHERE id = p_item_id;
  ELSIF p_action = 'archive' AND v_status = 'published' THEN
    UPDATE knowledge_items SET status = 'archived' WHERE id = p_item_id;
  ELSIF p_action = 'retry' AND v_version.ingestion_status = 'failed' AND v_status <> 'archived' THEN
    UPDATE document_versions SET ingestion_status = 'pending', error_message = NULL,
      indexing_progress = 0, indexing_started_at = NULL WHERE id = v_version.id;
  ELSE
    RETURN 'invalid_state';
  END IF;
  RETURN 'ok';
END;
$$;

INSERT INTO schema_migrations (version)
VALUES ('0037_document_lifecycle')
ON CONFLICT (version) DO NOTHING;
