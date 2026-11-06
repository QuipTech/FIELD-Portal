-- Files about one machine: service reports, inspections, certificates and
-- others. history_entry_id is set when the file was added with a history
-- entry; the machine's Documents tab lists both kinds. Soft delete only: the
-- row and S3 object stay, since this is part of the machine's record.
-- Rows belong to the machine's owning organisation. As for history and
-- photos (0117), a shared machine's documents can be read through an active
-- share, and 'contribute' adds them; only the owner changes them.

CREATE TABLE IF NOT EXISTS machine_documents (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id),
  machine_id        uuid NOT NULL REFERENCES machines(id),
  history_entry_id  uuid REFERENCES technical_history_entries(id),
  document_type     varchar NOT NULL
                      CHECK (document_type IN ('service_report', 'inspection', 'certificate', 'other')),
  storage_key       varchar NOT NULL,
  file_name         varchar NOT NULL,
  content_type      varchar NOT NULL,
  size_bytes        bigint NOT NULL,
  -- SET NULL: deleting a person's account doesn't remove the machine's record.
  uploaded_by       uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  row_version       integer NOT NULL DEFAULT 1,
  deleted_at        timestamptz
);

CREATE INDEX IF NOT EXISTS idx_machine_documents_machine
  ON machine_documents (tenant_id, machine_id, created_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_machine_documents_history_entry
  ON machine_documents (history_entry_id) WHERE history_entry_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_machine_documents_uploaded_by
  ON machine_documents (uploaded_by) WHERE uploaded_by IS NOT NULL;

DROP TRIGGER IF EXISTS trg_machine_documents_bump_row_version ON machine_documents;
CREATE TRIGGER trg_machine_documents_bump_row_version
  BEFORE UPDATE ON machine_documents
  FOR EACH ROW EXECUTE FUNCTION bump_row_version();

DROP TRIGGER IF EXISTS trg_machine_documents_meter_storage ON machine_documents;
CREATE TRIGGER trg_machine_documents_meter_storage
  AFTER INSERT OR UPDATE OF deleted_at ON machine_documents
  FOR EACH ROW EXECUTE FUNCTION app.meter_storage_delta();

ALTER TABLE machine_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE machine_documents FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS machine_documents_select ON machine_documents;
CREATE POLICY machine_documents_select ON machine_documents FOR SELECT
  USING (tenant_id = current_tenant_id()
    OR machine_id IN (SELECT machine_id FROM shared_machine_access()));

-- A contributor from another organisation adds files to the machine, or to
-- their own history entry on it (as for attachments, 0117).
DROP POLICY IF EXISTS machine_documents_insert ON machine_documents;
CREATE POLICY machine_documents_insert ON machine_documents FOR INSERT
  WITH CHECK (tenant_id = current_tenant_id()
    OR (uploaded_by = current_app_user_id()
        AND can_contribute_to_machine(machine_id, tenant_id)
        AND (history_entry_id IS NULL OR EXISTS (
          SELECT 1 FROM technical_history_entries h
          WHERE h.id = history_entry_id AND h.machine_id = machine_documents.machine_id
            AND h.created_by = current_app_user_id()))));

DROP POLICY IF EXISTS machine_documents_update ON machine_documents;
CREATE POLICY machine_documents_update ON machine_documents FOR UPDATE
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

GRANT SELECT, INSERT, UPDATE ON machine_documents TO field_app;

INSERT INTO schema_migrations (version)
VALUES ('0120_machine_documents')
ON CONFLICT (version) DO NOTHING;
