-- Section 3a: knowledge_items, with the licensing metadata added in the
-- Milestone 1 review corrections. resolution_record_id points at
-- resolution_records, created later in this section (0014) — the FK
-- constraint is added there once that table exists, to avoid a forward
-- reference within the migration sequence.

CREATE TABLE IF NOT EXISTS knowledge_items (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            uuid NOT NULL REFERENCES tenants(id),
  title                varchar NOT NULL,
  type                 varchar NOT NULL
                         CHECK (type IN ('document', 'known_issue', 'troubleshooting_guide', 'bulletin', 'resolution')),
  status               varchar NOT NULL DEFAULT 'draft'
                         CHECK (status IN ('draft', 'review', 'approved', 'published', 'archived', 'withdrawn')),
  source_type          varchar NOT NULL
                         CHECK (source_type IN ('oem', 'internal', 'resolution')),
  source_oem           varchar,
  licence_scope        varchar CHECK (licence_scope IN ('site', 'fleet', 'tenant')),
  permitted_use        varchar
                         CHECK (permitted_use IN ('internal_reference', 'ai_retrieval', 'ai_retrieval_and_display')),
  licence_expires_at   timestamptz,
  licence_reference    varchar,
  resolution_record_id uuid,
  created_by           uuid NOT NULL REFERENCES users(id),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  row_version          integer NOT NULL DEFAULT 1,
  deleted_at           timestamptz,
  CONSTRAINT knowledge_items_oem_licence_fields CHECK (
    source_type <> 'oem'
    OR (licence_expires_at IS NOT NULL AND licence_reference IS NOT NULL)
  ),
  CONSTRAINT knowledge_items_resolution_requires_record CHECK (
    type <> 'resolution' OR resolution_record_id IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_knowledge_items_tenant_id ON knowledge_items(tenant_id);

DROP TRIGGER IF EXISTS trg_knowledge_items_bump_row_version ON knowledge_items;
CREATE TRIGGER trg_knowledge_items_bump_row_version
  BEFORE UPDATE ON knowledge_items
  FOR EACH ROW EXECUTE FUNCTION bump_row_version();

ALTER TABLE knowledge_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_items FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS knowledge_items_select ON knowledge_items;
CREATE POLICY knowledge_items_select ON knowledge_items
  FOR SELECT USING (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS knowledge_items_insert ON knowledge_items;
CREATE POLICY knowledge_items_insert ON knowledge_items
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS knowledge_items_update ON knowledge_items;
CREATE POLICY knowledge_items_update ON knowledge_items
  FOR UPDATE USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

INSERT INTO schema_migrations (version)
VALUES ('0011_knowledge_items')
ON CONFLICT (version) DO NOTHING;
