BEGIN;
-- Old internal SQL writers receive metadata through transaction-local settings.
-- DTOs require brand/category; the fallback preserves existing maintenance tools.
CREATE OR REPLACE FUNCTION set_document_classification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    NEW.brand_id := COALESCE(NEW.brand_id,NULLIF(current_setting('app.knowledge_brand_id',true),'')::uuid,
      (SELECT id FROM knowledge_brands WHERE slug='uncategorised'));
    NEW.category_id := COALESCE(NEW.category_id,NULLIF(current_setting('app.knowledge_category_id',true),'')::uuid,
      (SELECT id FROM knowledge_categories WHERE brand_id=NEW.brand_id AND slug='general' AND parent_id IS NULL));
    NEW.document_type := COALESCE(NEW.document_type,(SELECT type FROM knowledge_items WHERE id=NEW.knowledge_item_id));
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS document_classification ON documents;
CREATE TRIGGER document_classification BEFORE INSERT ON documents FOR EACH ROW EXECUTE FUNCTION set_document_classification();
CREATE OR REPLACE FUNCTION sync_chunk_classification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  SELECT brand_id,category_id INTO NEW.brand_id,NEW.category_id FROM documents WHERE id=NEW.document_id FOR SHARE;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS chunk_classification ON document_chunks;
CREATE TRIGGER chunk_classification BEFORE INSERT OR UPDATE OF document_id ON document_chunks
  FOR EACH ROW EXECUTE FUNCTION sync_chunk_classification();
CREATE OR REPLACE FUNCTION sync_document_classification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  UPDATE document_chunks SET brand_id=NEW.brand_id,category_id=NEW.category_id WHERE document_id=NEW.id;
  UPDATE knowledge_items SET type=NEW.document_type WHERE id=NEW.knowledge_item_id;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS document_classification_update ON documents;
CREATE TRIGGER document_classification_update AFTER UPDATE OF brand_id,category_id,document_type ON documents
  FOR EACH ROW EXECUTE FUNCTION sync_document_classification();
CREATE OR REPLACE FUNCTION prevent_category_cycle()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(NEW.brand_id::text));
  IF NEW.parent_id IS NOT NULL AND EXISTS (
    WITH RECURSIVE parents AS (
      SELECT id,parent_id FROM knowledge_categories WHERE id=NEW.parent_id
      UNION SELECT c.id,c.parent_id FROM knowledge_categories c JOIN parents p ON c.id=p.parent_id
    ) SELECT 1 FROM parents WHERE id=NEW.id
  ) THEN RAISE EXCEPTION 'Category nesting cannot contain a cycle' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS category_cycle ON knowledge_categories;
CREATE TRIGGER category_cycle BEFORE INSERT OR UPDATE ON knowledge_categories FOR EACH ROW EXECUTE FUNCTION prevent_category_cycle();
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['knowledge_brands','knowledge_categories'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS bump_version ON %I',t);
  EXECUTE format('CREATE TRIGGER bump_version BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION bump_row_version()',t);
 END LOOP;
END $$;
-- Explicit model selections survive automatic model detection and re-indexing.
CREATE OR REPLACE FUNCTION link_document_machine_models(p_item_id uuid,p_model_ids uuid[],p_counts integer[])
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 DELETE FROM knowledge_item_machine_models WHERE knowledge_item_id=p_item_id;
 INSERT INTO knowledge_item_machine_models(knowledge_item_id,machine_model_id,tenant_id,mention_count)
 SELECT ki.id,u.model_id,ki.tenant_id,u.mentions FROM knowledge_items ki,unnest(p_model_ids,p_counts) u(model_id,mentions) WHERE ki.id=p_item_id;
 INSERT INTO knowledge_item_machine_models(knowledge_item_id,machine_model_id,tenant_id,mention_count)
 SELECT d.knowledge_item_id,m.machine_model_id,d.tenant_id,1 FROM document_machine_models m JOIN documents d ON d.id=m.document_id
 WHERE d.knowledge_item_id=p_item_id ON CONFLICT DO NOTHING;
$$;
-- Every new knowledge document, including client uploads, requires review.
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

  UPDATE knowledge_items SET status='review' WHERE id=v_item.id;
  v_state := 'needs_review';
  PERFORM log_indexing_transition(p_version_id, 'indexing', v_state, NULL);
  RETURN v_state;
END;
$$;


INSERT INTO schema_migrations(version) VALUES ('0087_knowledge_brand_consistency') ON CONFLICT DO NOTHING;
COMMIT;
