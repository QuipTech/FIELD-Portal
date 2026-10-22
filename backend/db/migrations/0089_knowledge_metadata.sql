BEGIN;
CREATE OR REPLACE FUNCTION update_knowledge_classification(p_item uuid,p_brand uuid,p_category uuid,p_type varchar,p_models uuid[],p_user uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_doc documents%ROWTYPE; v_tenant uuid;
BEGIN
 SELECT tenant_id INTO v_tenant FROM users WHERE id=p_user AND deleted_at IS NULL;
 SELECT * INTO v_doc FROM documents WHERE knowledge_item_id=p_item AND deleted_at IS NULL FOR UPDATE;
 IF v_doc.id IS NULL OR NOT (user_has_permission(p_user,'platform.manage') OR
   (v_doc.tenant_id=v_tenant AND user_has_permission(p_user,'knowledge.submit'))) THEN
   RAISE EXCEPTION 'Document not found' USING ERRCODE='P0002';
 END IF;
 IF NOT knowledge_has_brand_access(p_brand,v_tenant,p_user) OR NOT EXISTS
   (SELECT 1 FROM knowledge_categories WHERE id=p_category AND brand_id=p_brand) THEN
   RAISE EXCEPTION 'Invalid brand or category' USING ERRCODE='23514';
 END IF;
 IF EXISTS(SELECT 1 FROM unnest(p_models) m(id) WHERE NOT EXISTS
   (SELECT 1 FROM machine_models mm WHERE mm.id=m.id AND mm.deleted_at IS NULL
     AND (mm.tenant_id IS NULL OR mm.tenant_id=v_doc.tenant_id))) THEN
   RAISE EXCEPTION 'Invalid machine model' USING ERRCODE='23514';
 END IF;
 UPDATE documents SET brand_id=p_brand,category_id=p_category,document_type=p_type WHERE id=v_doc.id;
 IF p_models IS NOT NULL THEN
   DELETE FROM document_machine_models WHERE document_id=v_doc.id;
   INSERT INTO document_machine_models(document_id,machine_model_id) SELECT v_doc.id,unnest(p_models);
   DELETE FROM knowledge_item_machine_models WHERE knowledge_item_id=p_item;
   INSERT INTO knowledge_item_machine_models(knowledge_item_id,machine_model_id,tenant_id,mention_count)
     SELECT p_item,unnest(p_models),v_doc.tenant_id,1;
 END IF;
END $$;
REVOKE ALL ON FUNCTION update_knowledge_classification(uuid,uuid,uuid,varchar,uuid[],uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_knowledge_classification(uuid,uuid,uuid,varchar,uuid[],uuid) TO field_app;
INSERT INTO schema_migrations(version) VALUES ('0089_knowledge_metadata') ON CONFLICT DO NOTHING;
COMMIT;
