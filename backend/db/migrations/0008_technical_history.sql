-- Section 2c: technical_history_entries (append-only; corrections are
-- stored as amendments, never edited in place) and technical_attachments.

CREATE TABLE IF NOT EXISTS technical_history_entries (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES tenants(id),
  machine_id          uuid NOT NULL REFERENCES machines(id),
  entry_type          varchar NOT NULL
                        CHECK (entry_type IN ('service', 'repair', 'inspection', 'note')),
  description         text NOT NULL,
  created_by          uuid NOT NULL REFERENCES users(id),
  is_amendment        boolean NOT NULL DEFAULT false,
  original_entry_id   uuid REFERENCES technical_history_entries(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  row_version         integer NOT NULL DEFAULT 1,
  deleted_at          timestamptz
);

CREATE INDEX IF NOT EXISTS idx_technical_history_entries_tenant_id ON technical_history_entries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_technical_history_entries_machine_id ON technical_history_entries(machine_id);

DROP TRIGGER IF EXISTS trg_technical_history_entries_bump_row_version ON technical_history_entries;
CREATE TRIGGER trg_technical_history_entries_bump_row_version
  BEFORE UPDATE ON technical_history_entries
  FOR EACH ROW EXECUTE FUNCTION bump_row_version();

ALTER TABLE technical_history_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE technical_history_entries FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS technical_history_entries_select ON technical_history_entries;
CREATE POLICY technical_history_entries_select ON technical_history_entries
  FOR SELECT USING (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS technical_history_entries_insert ON technical_history_entries;
CREATE POLICY technical_history_entries_insert ON technical_history_entries
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());

CREATE TABLE IF NOT EXISTS technical_attachments (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL REFERENCES tenants(id),
  history_entry_id   uuid NOT NULL REFERENCES technical_history_entries(id),
  file_url           varchar NOT NULL,
  file_type          varchar NOT NULL
                        CHECK (file_type IN ('photo', 'video', 'voice_note', 'document')),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  row_version        integer NOT NULL DEFAULT 1,
  deleted_at         timestamptz
);

CREATE INDEX IF NOT EXISTS idx_technical_attachments_tenant_id ON technical_attachments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_technical_attachments_history_entry_id ON technical_attachments(history_entry_id);

DROP TRIGGER IF EXISTS trg_technical_attachments_bump_row_version ON technical_attachments;
CREATE TRIGGER trg_technical_attachments_bump_row_version
  BEFORE UPDATE ON technical_attachments
  FOR EACH ROW EXECUTE FUNCTION bump_row_version();

ALTER TABLE technical_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE technical_attachments FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS technical_attachments_select ON technical_attachments;
CREATE POLICY technical_attachments_select ON technical_attachments
  FOR SELECT USING (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS technical_attachments_insert ON technical_attachments;
CREATE POLICY technical_attachments_insert ON technical_attachments
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());

INSERT INTO schema_migrations (version)
VALUES ('0008_technical_history')
ON CONFLICT (version) DO NOTHING;
