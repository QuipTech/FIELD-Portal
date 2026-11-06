-- On a shared machine, a 'contribute' person may soft delete the documents
-- they uploaded themselves. The owning organisation can still change any.

DROP POLICY IF EXISTS machine_documents_update ON machine_documents;
CREATE POLICY machine_documents_update ON machine_documents FOR UPDATE
  USING (tenant_id = current_tenant_id()
    OR (uploaded_by = current_app_user_id()
        AND can_contribute_to_machine(machine_id, tenant_id)))
  WITH CHECK (tenant_id = current_tenant_id()
    OR (uploaded_by = current_app_user_id()
        AND can_contribute_to_machine(machine_id, tenant_id)));

INSERT INTO schema_migrations (version)
VALUES ('0122_machine_documents_delete_own')
ON CONFLICT (version) DO NOTHING;
