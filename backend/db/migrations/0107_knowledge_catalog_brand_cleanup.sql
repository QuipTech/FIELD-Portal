-- Removes what the first draft of 0102 added for manufacturer-based brands,
-- now replaced by 0084's knowledge_brands / knowledge_categories and 0093's
-- open brand access. A no-op on databases that never ran that draft.
--   * plan brand restriction: tenant_brand_access,
--     tenants.knowledge_brands_restricted and their admin functions
--   * knowledge_items.manufacturer_id / category_id and
--     set_knowledge_item_classification() (brand and category now live on
--     documents, set through PATCH /admin/knowledge/documents/:id)
--   * document_pages visibility, aligned with document_sections (0086)

DROP FUNCTION IF EXISTS set_tenant_brand_access(uuid, boolean, uuid[], uuid);
DROP FUNCTION IF EXISTS admin_get_tenant_brand_access(uuid);
DROP FUNCTION IF EXISTS set_knowledge_item_classification(uuid, uuid, uuid);

DROP TABLE IF EXISTS tenant_brand_access;
ALTER TABLE tenants DROP COLUMN IF EXISTS knowledge_brands_restricted;

DROP INDEX IF EXISTS idx_knowledge_items_manufacturer_id;
DROP INDEX IF EXISTS idx_knowledge_items_category_id;
ALTER TABLE knowledge_items DROP COLUMN IF EXISTS manufacturer_id;
ALTER TABLE knowledge_items DROP COLUMN IF EXISTS category_id;

DROP POLICY IF EXISTS document_pages_select ON document_pages;
CREATE POLICY document_pages_select ON document_pages
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM document_versions v
    WHERE v.id = document_version_id
      AND knowledge_can_read_document(v.document_id, current_tenant_id())));

INSERT INTO schema_migrations (version)
VALUES ('0107_knowledge_catalog_brand_cleanup')
ON CONFLICT (version) DO NOTHING;
