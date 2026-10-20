BEGIN;
CREATE TABLE IF NOT EXISTS knowledge_brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name varchar(150) NOT NULL,
  slug varchar(150) NOT NULL UNIQUE, logo_file_id uuid, logo_storage_key varchar,
  description text NOT NULL DEFAULT '', is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(), row_version integer NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS knowledge_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), brand_id uuid NOT NULL REFERENCES knowledge_brands(id),
  parent_id uuid, name varchar(150) NOT NULL, slug varchar(150) NOT NULL,
  sort_order integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(), row_version integer NOT NULL DEFAULT 1,
  UNIQUE(id, brand_id), FOREIGN KEY(parent_id, brand_id) REFERENCES knowledge_categories(id, brand_id),
  CHECK(parent_id IS DISTINCT FROM id)
);
CREATE UNIQUE INDEX IF NOT EXISTS knowledge_category_path ON knowledge_categories
  (brand_id, COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), slug);
CREATE TABLE IF NOT EXISTS organisation_brand_access (
  organisation_id uuid NOT NULL REFERENCES tenants(id), brand_id uuid NOT NULL REFERENCES knowledge_brands(id),
  granted_by uuid REFERENCES users(id) ON DELETE SET NULL, granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(organisation_id, brand_id)
);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS brand_id uuid REFERENCES knowledge_brands(id);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS category_id uuid;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS document_type varchar;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'documents_category_brand') THEN
    ALTER TABLE documents ADD CONSTRAINT documents_category_brand FOREIGN KEY(category_id, brand_id)
      REFERENCES knowledge_categories(id, brand_id);
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS document_machine_models (
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  machine_model_id uuid NOT NULL REFERENCES machine_models(id),
  PRIMARY KEY(document_id, machine_model_id)
);
ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS brand_id uuid REFERENCES knowledge_brands(id);
ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES knowledge_categories(id);
CREATE INDEX IF NOT EXISTS documents_brand_category ON documents(brand_id, category_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS chunks_brand_category ON document_chunks(brand_id, category_id, document_version_id);
CREATE INDEX IF NOT EXISTS document_models_model ON document_machine_models(machine_model_id, document_id);
CREATE INDEX IF NOT EXISTS organisation_brand_lookup ON organisation_brand_access(brand_id, organisation_id);
ALTER TABLE knowledge_items DROP CONSTRAINT IF EXISTS knowledge_items_type_check;
ALTER TABLE knowledge_items ADD CONSTRAINT knowledge_items_type_check CHECK
  (type IN ('document','known_issue','troubleshooting_guide','bulletin','resolution','manual','procedure','policy','parts_book','guide','knownIssue'));
INSERT INTO schema_migrations(version) VALUES ('0084_knowledge_brand_schema') ON CONFLICT DO NOTHING;
COMMIT;
