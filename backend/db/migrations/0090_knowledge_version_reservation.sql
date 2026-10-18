BEGIN;
CREATE OR REPLACE FUNCTION reserve_knowledge_version(p_item uuid,p_version uuid,p_user uuid,p_bucket varchar,
  p_name varchar,p_safe_name varchar,p_content_type varchar,p_size bigint)
RETURNS TABLE(version_number integer,storage_key varchar)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_doc documents%ROWTYPE; v_number integer; v_key varchar; v_tenant uuid;
BEGIN
 SELECT tenant_id INTO v_tenant FROM users WHERE id=p_user AND deleted_at IS NULL;
 SELECT * INTO v_doc FROM documents WHERE knowledge_item_id=p_item AND deleted_at IS NULL FOR UPDATE;
 IF v_doc.id IS NULL OR NOT knowledge_can_read_document(v_doc.id,v_tenant,p_user)
   OR NOT (user_has_permission(p_user,'platform.manage') OR (v_doc.tenant_id=v_tenant AND user_has_permission(p_user,'knowledge.submit')))
 THEN RETURN; END IF;
 IF EXISTS(SELECT 1 FROM document_versions WHERE document_id=v_doc.id AND ingestion_status IN ('pending','parsing','chunking','embedding'))
 THEN RAISE EXCEPTION 'A version is already processing' USING ERRCODE='23514'; END IF;
 SELECT COALESCE(max(v.version_number),0)+1 INTO v_number FROM document_versions v WHERE document_id=v_doc.id;
 IF p_safe_name !~ '^[A-Za-z0-9._-]+$' OR p_safe_name IN ('.','..') THEN RAISE EXCEPTION 'Invalid file name'; END IF;
 v_key := 'knowledge/brands/'||v_doc.brand_id||'/'||v_doc.category_id||'/'||v_doc.id||'/v'||v_number||'/'||p_safe_name;
 PERFORM create_document_version(p_item,p_version,p_user,p_bucket,v_key,p_name,p_content_type,p_size,false);
 RETURN QUERY SELECT v_number,v_key;
END $$;
REVOKE ALL ON FUNCTION reserve_knowledge_version(uuid,uuid,uuid,varchar,varchar,varchar,varchar,bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reserve_knowledge_version(uuid,uuid,uuid,varchar,varchar,varchar,varchar,bigint) TO field_app;
INSERT INTO schema_migrations(version) VALUES ('0090_knowledge_version_reservation') ON CONFLICT DO NOTHING;
COMMIT;
