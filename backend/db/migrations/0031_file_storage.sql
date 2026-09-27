-- Section 8: file storage in S3 (bucket from S3_PORTAL_STORAGE_BUCKET).
-- The database stores S3 object keys, never URLs; the backend signs
-- short-lived download URLs on read. Folders: documents/, photos/,
-- avatars/ — see the backend README.

-- Machine photos on technical history entries live in the existing
-- technical_attachments table (file_type = 'photo').
ALTER TABLE technical_attachments ADD COLUMN IF NOT EXISTS storage_key varchar;
ALTER TABLE technical_attachments ADD COLUMN IF NOT EXISTS file_name varchar;
ALTER TABLE technical_attachments ADD COLUMN IF NOT EXISTS content_type varchar;
ALTER TABLE technical_attachments ADD COLUMN IF NOT EXISTS size_bytes bigint;
ALTER TABLE technical_attachments ADD COLUMN IF NOT EXISTS uploaded_by uuid REFERENCES users(id);

-- Photos are soft-deleted (deleted_at), which needs an update policy; the
-- S3 object is kept for the audit trail.
DROP POLICY IF EXISTS technical_attachments_update ON technical_attachments;
CREATE POLICY technical_attachments_update ON technical_attachments
  FOR UPDATE USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- The portal's history entry types include Fault.
ALTER TABLE technical_history_entries DROP CONSTRAINT IF EXISTS technical_history_entries_entry_type_check;
ALTER TABLE technical_history_entries ADD CONSTRAINT technical_history_entries_entry_type_check
  CHECK (entry_type IN ('service', 'repair', 'inspection', 'note', 'fault'));

-- An uploaded avatar's S3 key. avatar_url keeps the Google photo URL; an
-- uploaded avatar takes precedence, and a Google sign-in never replaces it.
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_storage_key varchar;

INSERT INTO permissions (code, description) VALUES
  ('history.delete_photos', 'Delete machine photos')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id, tenant_id)
SELECT r.id, p.id, NULL
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Owner' AND r.is_system_role AND r.tenant_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO schema_migrations (version)
VALUES ('0031_file_storage')
ON CONFLICT (version) DO NOTHING;
