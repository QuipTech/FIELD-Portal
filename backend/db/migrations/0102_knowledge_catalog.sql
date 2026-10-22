-- Section 3e: the mobile app's Knowledge catalogue (/knowledge/documents/:id/pages/:n,
-- /me/knowledge/recent …). Brands and categories are 0084's knowledge_brands
-- and knowledge_categories (on documents); access is 0086's
-- knowledge_can_read_document.
--   * knowledge_recent_views: each user's recently opened documents and
--     the page they were on.
--   * document_pages: each version's text per page, saved by the indexer;
--     image_storage_key stays NULL until page images are rendered.

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
-- Same rule as document_sections (0086).
CREATE POLICY document_pages_select ON document_pages
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM document_versions v
    WHERE v.id = document_version_id
      AND knowledge_can_read_document(v.document_id, current_tenant_id())));
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

REVOKE ALL ON FUNCTION replace_document_pages(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION replace_document_pages(uuid, jsonb) TO field_app;

INSERT INTO schema_migrations (version)
VALUES ('0102_knowledge_catalog')
ON CONFLICT (version) DO NOTHING;
