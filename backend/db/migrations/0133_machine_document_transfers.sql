ALTER TABLE machine_documents
  ADD COLUMN IF NOT EXISTS source_device_id uuid,
  ADD COLUMN IF NOT EXISTS device_transfer_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS uq_machine_documents_device_transfer
  ON machine_documents (source_device_id, device_transfer_id);

INSERT INTO schema_migrations (version)
VALUES ('0133_machine_document_transfers')
ON CONFLICT (version) DO NOTHING;
