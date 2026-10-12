-- Section 3d: the Knowledge article page (/knowledge/:id) reads a
-- document as sections, not as search chunks. Chunks are ~900 tokens and
-- keep only the heading and page they start on, so a short bulletin is a
-- single chunk. The indexer now also saves what it extracted:
--   * document_sections: each heading with its body text and start page,
--     in reading order (ordinal), per document version
--   * document_figures: figure captions ("Figure 3 — …") and their page;
--     image_storage_key stays NULL until page images are rendered, and the
--     portal shows a captioned placeholder
--   * document_versions.summary: an AI summary, when indexing saves one
--     (none yet); otherwise the article opens with section 1's first
--     paragraph
-- Versions indexed before this migration have no rows here; the API
-- rebuilds their sections from the chunk text and saves them the first
-- time the article is opened (backfill_document_sections). Rows go with
-- their version (ON DELETE CASCADE) and are written only through these
-- SECURITY DEFINER functions, like insert_document_chunks() (0036).

ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS summary text;

CREATE TABLE IF NOT EXISTS document_sections (
  document_version_id  uuid NOT NULL REFERENCES document_versions(id) ON DELETE CASCADE,
  ordinal              integer NOT NULL,
  -- NULL for the shared library, like the version.
  tenant_id            uuid REFERENCES tenants(id),
  heading              varchar,
  page_number          integer,
  content              text NOT NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (document_version_id, ordinal)
);

CREATE TABLE IF NOT EXISTS document_figures (
  document_version_id  uuid NOT NULL REFERENCES document_versions(id) ON DELETE CASCADE,
  ordinal              integer NOT NULL,
  section_ordinal      integer NOT NULL,
  tenant_id            uuid REFERENCES tenants(id),
  page_number          integer,
  caption              text NOT NULL,
  image_storage_key    varchar,
  created_at           timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (document_version_id, ordinal)
);

ALTER TABLE document_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_sections FORCE ROW LEVEL SECURITY;
ALTER TABLE document_figures ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_figures FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS document_sections_select ON document_sections;
CREATE POLICY document_sections_select ON document_sections
  FOR SELECT USING (tenant_id IS NULL OR tenant_id = current_tenant_id());
DROP POLICY IF EXISTS document_figures_select ON document_figures;
CREATE POLICY document_figures_select ON document_figures
  FOR SELECT USING (tenant_id IS NULL OR tenant_id = current_tenant_id());

-- The app only reads them.
REVOKE INSERT, UPDATE, DELETE ON document_sections FROM field_app;
REVOKE INSERT, UPDATE, DELETE ON document_figures FROM field_app;

-- Search results open the article at the best-matching section.
CREATE INDEX IF NOT EXISTS idx_document_sections_text
  ON document_sections USING gin (to_tsvector('english', coalesce(heading, '') || ' ' || content));

-- Internal: writes a version's sections and figures (replacing any).
-- p_sections: [{ordinal, heading, page, content}];
-- p_figures: [{ordinal, sectionOrdinal, page, caption}].
CREATE OR REPLACE FUNCTION write_document_sections(
  p_version_id uuid, p_tenant_id uuid, p_sections jsonb, p_figures jsonb
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM document_figures WHERE document_version_id = p_version_id;
  DELETE FROM document_sections WHERE document_version_id = p_version_id;
  INSERT INTO document_sections (document_version_id, ordinal, tenant_id, heading, page_number, content)
  SELECT p_version_id, s.ordinal, p_tenant_id, s.heading, s.page, s.content
  FROM jsonb_to_recordset(p_sections) AS s(ordinal integer, heading varchar, page integer, content text);
  INSERT INTO document_figures (document_version_id, ordinal, section_ordinal, tenant_id, page_number, caption)
  SELECT p_version_id, f.ordinal, f."sectionOrdinal", p_tenant_id, f.page, f.caption
  FROM jsonb_to_recordset(p_figures) AS f(ordinal integer, "sectionOrdinal" integer, page integer, caption text);
$$;

-- The indexer: a version's sections, while it is being indexed.
CREATE OR REPLACE FUNCTION replace_document_sections(
  p_version_id uuid, p_sections jsonb, p_figures jsonb
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT write_document_sections(dv.id, dv.tenant_id, p_sections, p_figures)
  FROM document_versions dv
  WHERE dv.id = p_version_id AND dv.ingestion_status IN ('parsing', 'chunking', 'embedding');
$$;

-- The API, for a live version indexed before this migration: saves the
-- sections it rebuilt from the chunks the first time the article is
-- opened. Never overwrites sections that are already there.
CREATE OR REPLACE FUNCTION backfill_document_sections(
  p_version_id uuid, p_sections jsonb, p_figures jsonb
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT write_document_sections(dv.id, dv.tenant_id, p_sections, p_figures)
  FROM document_versions dv
  JOIN documents d ON d.live_version_id = dv.id
  WHERE dv.id = p_version_id
    AND NOT EXISTS (SELECT 1 FROM document_sections s WHERE s.document_version_id = dv.id);
$$;

REVOKE ALL ON FUNCTION write_document_sections(uuid, uuid, jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION replace_document_sections(uuid, jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION backfill_document_sections(uuid, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION replace_document_sections(uuid, jsonb, jsonb) TO field_app;
GRANT EXECUTE ON FUNCTION backfill_document_sections(uuid, jsonb, jsonb) TO field_app;

INSERT INTO schema_migrations (version)
VALUES ('0076_document_sections')
ON CONFLICT (version) DO NOTHING;
