BEGIN;
INSERT INTO knowledge_brands(name, slug, sort_order) VALUES ('Uncategorised','uncategorised',9999)
  ON CONFLICT(slug) DO NOTHING;
INSERT INTO knowledge_categories(brand_id,name,slug)
  SELECT id,'General','general' FROM knowledge_brands b WHERE slug = 'uncategorised'
  AND NOT EXISTS (SELECT 1 FROM knowledge_categories c WHERE c.brand_id=b.id AND c.parent_id IS NULL AND c.slug='general');
UPDATE documents d SET brand_id=c.brand_id, category_id=c.id, document_type=ki.type
  FROM knowledge_categories c, knowledge_brands b, knowledge_items ki
  WHERE c.brand_id=b.id AND b.slug='uncategorised' AND c.slug='general' AND c.parent_id IS NULL
    AND ki.id=d.knowledge_item_id AND d.brand_id IS NULL;
UPDATE document_chunks c SET brand_id=d.brand_id, category_id=d.category_id FROM documents d
  WHERE c.document_id=d.id AND (c.brand_id IS DISTINCT FROM d.brand_id OR c.category_id IS DISTINCT FROM d.category_id);
INSERT INTO organisation_brand_access(organisation_id,brand_id)
  SELECT t.id,b.id FROM tenants t CROSS JOIN knowledge_brands b WHERE b.slug='uncategorised'
  ON CONFLICT DO NOTHING;
INSERT INTO document_machine_models(document_id,machine_model_id)
  SELECT d.id,km.machine_model_id FROM knowledge_item_machine_models km JOIN documents d ON d.knowledge_item_id=km.knowledge_item_id
  ON CONFLICT DO NOTHING;
ALTER TABLE documents ALTER COLUMN brand_id SET NOT NULL;
ALTER TABLE documents ALTER COLUMN category_id SET NOT NULL;
ALTER TABLE documents ALTER COLUMN document_type SET NOT NULL;
ALTER TABLE document_chunks ALTER COLUMN brand_id SET NOT NULL;
ALTER TABLE document_chunks ALTER COLUMN category_id SET NOT NULL;
INSERT INTO schema_migrations(version) VALUES ('0085_knowledge_brand_backfill') ON CONFLICT DO NOTHING;
COMMIT;
