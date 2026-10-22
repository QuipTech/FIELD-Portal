-- Section 3e: the mobile app's Knowledge catalogue (GET /knowledge/brands,
-- /knowledge/documents/:id/pages/:n, /me/knowledge/recent …).
--   * Brands are machine_manufacturers. A knowledge item's brand is its
--     manufacturer_id when an admin set one, otherwise the manufacturer of
--     the model it mentions most (computed by the API, so documents indexed
--     before this migration need no backfill).
--   * knowledge_categories: each brand's document categories (Engine,
--     Hydraulics …), shared across organisations like model_systems (0040).
--   * tenant_brand_access + tenants.knowledge_brands_restricted: the brands
--     an organisation's plan includes. Unrestricted (the default) means
--     every brand, so existing organisations keep their whole library.
--     Documents without a brand are always visible.
--   * knowledge_recent_views: each user's recently opened documents and
--     the page they were on.
--   * document_pages: each version's text per page, saved by the indexer;
--     image_storage_key stays NULL until page images are rendered.

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS knowledge_brands_restricted boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS knowledge_categories (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manufacturer_id  uuid NOT NULL REFERENCES machine_manufacturers(id),
  name             varchar NOT NULL,
  sort_order       integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_knowledge_categories_live_name
  ON knowledge_categories (manufacturer_id, lower(name)) WHERE deleted_at IS NULL;

-- Shared catalogue data: no RLS. Only platform admins write it (backend guard).
GRANT SELECT, INSERT, UPDATE ON knowledge_categories TO field_app;

ALTER TABLE knowledge_items
  ADD COLUMN IF NOT EXISTS manufacturer_id uuid REFERENCES machine_manufacturers(id),
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES knowledge_categories(id);

CREATE INDEX IF NOT EXISTS idx_knowledge_items_manufacturer_id ON knowledge_items(manufacturer_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_items_category_id ON knowledge_items(category_id);

CREATE TABLE IF NOT EXISTS tenant_brand_access (
  tenant_id        uuid NOT NULL REFERENCES tenants(id),
  manufacturer_id  uuid NOT NULL REFERENCES machine_manufacturers(id),
  granted_by       uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, manufacturer_id)
);

ALTER TABLE tenant_brand_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_brand_access FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_brand_access_select ON tenant_brand_access;
CREATE POLICY tenant_brand_access_select ON tenant_brand_access
  FOR SELECT USING (tenant_id = current_tenant_id());
-- Changes go through set_tenant_brand_access() below.
REVOKE INSERT, UPDATE, DELETE ON tenant_brand_access FROM field_app;
GRANT SELECT ON tenant_brand_access TO field_app;

CREATE TABLE IF NOT EXISTS knowledge_recent_views (
  tenant_id          uuid NOT NULL REFERENCES tenants(id),
  user_id            uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  knowledge_item_id  uuid NOT NULL REFERENCES knowledge_items(id) ON DELETE CASCADE,
  last_page          integer CHECK (last_page IS NULL OR last_page >= 1),
  viewed_at          timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, knowledge_item_id)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_recent_views_user_viewed
  ON knowledge_recent_views (user_id, viewed_at DESC);

ALTER TABLE knowledge_recent_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_recent_views FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS knowledge_recent_views_all ON knowledge_recent_views;
CREATE POLICY knowledge_recent_views_all ON knowledge_recent_views
  FOR ALL USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON knowledge_recent_views TO field_app;

CREATE TABLE IF NOT EXISTS document_pages (
  document_version_id  uuid NOT NULL REFERENCES document_versions(id) ON DELETE CASCADE,
  page_number          integer NOT NULL CHECK (page_number >= 1),
  -- NULL for the shared library, like the version.
  tenant_id            uuid REFERENCES tenants(id),
  content              text NOT NULL,
  image_storage_key    varchar,
  created_at           timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (document_version_id, page_number)
);

ALTER TABLE document_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_pages FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS document_pages_select ON document_pages;
CREATE POLICY document_pages_select ON document_pages
  FOR SELECT USING (tenant_id IS NULL OR tenant_id = current_tenant_id());
REVOKE INSERT, UPDATE, DELETE ON document_pages FROM field_app;
GRANT SELECT ON document_pages TO field_app;

CREATE INDEX IF NOT EXISTS idx_document_pages_text
  ON document_pages USING gin (to_tsvector('english', content));

-- The indexer: a version's page text while it is being indexed (like
-- replace_document_sections, 0076). p_pages: [{page, content}].
CREATE OR REPLACE FUNCTION replace_document_pages(p_version_id uuid, p_pages jsonb)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM document_pages
  WHERE document_version_id = p_version_id
    AND EXISTS (SELECT 1 FROM document_versions dv
                WHERE dv.id = p_version_id
                  AND dv.ingestion_status IN ('parsing', 'chunking', 'embedding'));
  INSERT INTO document_pages (document_version_id, page_number, tenant_id, content)
  SELECT dv.id, p.page, dv.tenant_id, p.content
  FROM document_versions dv
  CROSS JOIN jsonb_to_recordset(p_pages) AS p(page integer, content text)
  WHERE dv.id = p_version_id AND dv.ingestion_status IN ('parsing', 'chunking', 'embedding');
$$;

-- Platform admins: which brands an organisation's plan includes.
CREATE OR REPLACE FUNCTION set_tenant_brand_access(
  p_tenant_id uuid, p_restricted boolean, p_brand_ids uuid[], p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE tenants SET knowledge_brands_restricted = p_restricted WHERE id = p_tenant_id;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  DELETE FROM tenant_brand_access
  WHERE tenant_id = p_tenant_id AND NOT (manufacturer_id = ANY (p_brand_ids));
  INSERT INTO tenant_brand_access (tenant_id, manufacturer_id, granted_by)
  SELECT p_tenant_id, brand_id, p_user_id FROM unnest(p_brand_ids) AS brand_id
  ON CONFLICT (tenant_id, manufacturer_id) DO NOTHING;
  RETURN true;
END;
$$;

-- An organisation's brand access, for the platform admin's edit form.
CREATE OR REPLACE FUNCTION admin_get_tenant_brand_access(p_tenant_id uuid)
RETURNS TABLE (restricted boolean, brand_ids uuid[])
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT t.knowledge_brands_restricted,
         COALESCE((SELECT array_agg(a.manufacturer_id) FROM tenant_brand_access a
                   WHERE a.tenant_id = t.id), '{}')
  FROM tenants t WHERE t.id = p_tenant_id;
$$;

-- Sets a knowledge item's brand and category (either may be NULL). The
-- backend checks who may change the item first; SECURITY DEFINER because
-- shared-library items (tenant_id NULL) aren't updatable under RLS.
CREATE OR REPLACE FUNCTION set_knowledge_item_classification(
  p_item_id uuid, p_brand_id uuid, p_category_id uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH updated AS (
    UPDATE knowledge_items
    SET manufacturer_id = p_brand_id, category_id = p_category_id, updated_at = now()
    WHERE id = p_item_id AND deleted_at IS NULL
    RETURNING id
  )
  SELECT EXISTS (SELECT 1 FROM updated);
$$;

REVOKE ALL ON FUNCTION replace_document_pages(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION set_tenant_brand_access(uuid, boolean, uuid[], uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_get_tenant_brand_access(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION set_knowledge_item_classification(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION replace_document_pages(uuid, jsonb) TO field_app;
GRANT EXECUTE ON FUNCTION set_tenant_brand_access(uuid, boolean, uuid[], uuid) TO field_app;
GRANT EXECUTE ON FUNCTION admin_get_tenant_brand_access(uuid) TO field_app;
GRANT EXECUTE ON FUNCTION set_knowledge_item_classification(uuid, uuid, uuid) TO field_app;

INSERT INTO schema_migrations (version)
VALUES ('0102_knowledge_catalog')
ON CONFLICT (version) DO NOTHING;
