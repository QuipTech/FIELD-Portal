BEGIN;
-- All request paths use this predicate; grant checks are never cached in JWTs.
CREATE OR REPLACE FUNCTION knowledge_has_brand_access(p_brand uuid, p_tenant uuid,
  p_user uuid DEFAULT NULLIF(current_setting('app.user_id', true),'')::uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM knowledge_brands b WHERE b.id=p_brand AND
    (user_has_permission(p_user,'platform.manage') OR (b.is_active AND EXISTS
      (SELECT 1 FROM organisation_brand_access a WHERE a.brand_id=b.id AND a.organisation_id=p_tenant))));
$$;
CREATE OR REPLACE FUNCTION knowledge_can_read_document(p_document uuid, p_tenant uuid,
  p_user uuid DEFAULT NULLIF(current_setting('app.user_id', true),'')::uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM documents d JOIN knowledge_items ki ON ki.id=d.knowledge_item_id
    WHERE d.id=p_document AND d.deleted_at IS NULL AND ki.deleted_at IS NULL
    AND knowledge_has_brand_access(d.brand_id,p_tenant,p_user)
    AND (user_has_permission(p_user,'platform.manage') OR d.tenant_id IS NULL OR d.tenant_id=p_tenant));
$$;
CREATE OR REPLACE FUNCTION knowledge_can_read_item(p_item uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM documents d WHERE d.knowledge_item_id=p_item
   AND knowledge_can_read_document(d.id,current_tenant_id()));
$$;
REVOKE ALL ON FUNCTION knowledge_has_brand_access(uuid,uuid,uuid), knowledge_can_read_document(uuid,uuid,uuid), knowledge_can_read_item(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION knowledge_has_brand_access(uuid,uuid,uuid), knowledge_can_read_document(uuid,uuid,uuid), knowledge_can_read_item(uuid) TO field_app;
DROP POLICY IF EXISTS knowledge_items_select ON knowledge_items;
CREATE POLICY knowledge_items_select ON knowledge_items FOR SELECT USING (knowledge_can_read_item(id));
DROP POLICY IF EXISTS documents_select ON documents;
CREATE POLICY documents_select ON documents FOR SELECT USING (knowledge_can_read_document(id,current_tenant_id()));
DROP POLICY IF EXISTS document_versions_select ON document_versions;
CREATE POLICY document_versions_select ON document_versions FOR SELECT USING (knowledge_can_read_document(document_id,current_tenant_id()));
DROP POLICY IF EXISTS document_chunks_select ON document_chunks;
CREATE POLICY document_chunks_select ON document_chunks FOR SELECT USING (knowledge_can_read_document(document_id,current_tenant_id()));
DROP POLICY IF EXISTS document_sections_select ON document_sections;
CREATE POLICY document_sections_select ON document_sections FOR SELECT USING (EXISTS
  (SELECT 1 FROM document_versions v WHERE v.id=document_version_id AND knowledge_can_read_document(v.document_id,current_tenant_id())));
DROP POLICY IF EXISTS document_figures_select ON document_figures;
CREATE POLICY document_figures_select ON document_figures FOR SELECT USING (EXISTS
  (SELECT 1 FROM document_versions v WHERE v.id=document_version_id AND knowledge_can_read_document(v.document_id,current_tenant_id())));
CREATE OR REPLACE FUNCTION knowledge_is_platform_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT user_has_permission(NULLIF(current_setting('app.user_id',true),'')::uuid,'platform.manage');
$$;
REVOKE ALL ON FUNCTION knowledge_is_platform_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION knowledge_is_platform_admin() TO field_app;
DROP POLICY IF EXISTS documents_platform_update ON documents;
CREATE POLICY documents_platform_update ON documents FOR UPDATE USING(knowledge_is_platform_admin()) WITH CHECK(knowledge_is_platform_admin());
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['knowledge_brands','knowledge_categories','organisation_brand_access','document_machine_models'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
    EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON %I TO field_app',t);
    EXECUTE format('DROP POLICY IF EXISTS platform_write ON %I',t);
    EXECUTE format('CREATE POLICY platform_write ON %I FOR ALL USING (knowledge_is_platform_admin()) WITH CHECK (knowledge_is_platform_admin())',t);
  END LOOP;
END $$;
DROP POLICY IF EXISTS brand_read ON knowledge_brands;
CREATE POLICY brand_read ON knowledge_brands FOR SELECT USING (knowledge_has_brand_access(id,current_tenant_id()));
DROP POLICY IF EXISTS category_read ON knowledge_categories;
CREATE POLICY category_read ON knowledge_categories FOR SELECT USING (knowledge_has_brand_access(brand_id,current_tenant_id()));
DROP POLICY IF EXISTS grant_read ON organisation_brand_access;
CREATE POLICY grant_read ON organisation_brand_access FOR SELECT USING (organisation_id=current_tenant_id());
DROP POLICY IF EXISTS model_link_read ON document_machine_models;
CREATE POLICY model_link_read ON document_machine_models FOR SELECT USING (knowledge_can_read_document(document_id,current_tenant_id()));
DROP POLICY IF EXISTS knowledge_item_machine_models_select ON knowledge_item_machine_models;
CREATE POLICY knowledge_item_machine_models_select ON knowledge_item_machine_models FOR SELECT USING(knowledge_can_read_item(knowledge_item_id));
INSERT INTO schema_migrations(version) VALUES ('0086_knowledge_brand_access') ON CONFLICT DO NOTHING;
COMMIT;
