-- Internal notes can be edited and deleted by staff. Deleting is soft
-- (deleted_at), like the rest of the schema; edited_at marks a changed
-- note. Only internal notes are changed — the backend refuses customer
-- replies — but RLS still needs an UPDATE policy for the case's tenant.

ALTER TABLE support_updates
  ADD COLUMN IF NOT EXISTS edited_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

DROP POLICY IF EXISTS support_updates_update ON support_updates;
CREATE POLICY support_updates_update ON support_updates
  FOR UPDATE USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

INSERT INTO schema_migrations (version)
VALUES ('0081_editable_internal_notes')
ON CONFLICT (version) DO NOTHING;
