-- Section 3d: resolution_records — the only path from an AI conversation
-- into published knowledge. conversation_id references ai_conversations,
-- which doesn't exist until Section 4 (0015_ai_conversations_messages.sql)
-- — that migration adds the FK once both tables exist. Here we also close
-- the loop on knowledge_items.resolution_record_id from 0011.

CREATE TABLE IF NOT EXISTS resolution_records (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL REFERENCES tenants(id),
  conversation_id    uuid,
  machine_id         uuid REFERENCES machines(id),
  problem_summary    text NOT NULL,
  root_cause         text,
  resolution_steps   text,
  authored_by        uuid NOT NULL REFERENCES users(id),
  status             varchar NOT NULL DEFAULT 'draft'
                       CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
  approved_by        uuid REFERENCES users(id),
  approved_at        timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  row_version        integer NOT NULL DEFAULT 1,
  CONSTRAINT resolution_records_approval_set_together CHECK (
    (approved_by IS NULL) = (approved_at IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_resolution_records_tenant_id ON resolution_records(tenant_id);

DROP TRIGGER IF EXISTS trg_resolution_records_bump_row_version ON resolution_records;
CREATE TRIGGER trg_resolution_records_bump_row_version
  BEFORE UPDATE ON resolution_records
  FOR EACH ROW EXECUTE FUNCTION bump_row_version();

ALTER TABLE resolution_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE resolution_records FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS resolution_records_select ON resolution_records;
CREATE POLICY resolution_records_select ON resolution_records
  FOR SELECT USING (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS resolution_records_insert ON resolution_records;
CREATE POLICY resolution_records_insert ON resolution_records
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS resolution_records_update ON resolution_records;
CREATE POLICY resolution_records_update ON resolution_records
  FOR UPDATE USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_knowledge_items_resolution_record'
  ) THEN
    ALTER TABLE knowledge_items
      ADD CONSTRAINT fk_knowledge_items_resolution_record
      FOREIGN KEY (resolution_record_id) REFERENCES resolution_records(id);
  END IF;
END
$$;

INSERT INTO schema_migrations (version)
VALUES ('0014_knowledge_resolution_records')
ON CONFLICT (version) DO NOTHING;
