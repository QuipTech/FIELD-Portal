-- On a shared machine, a 'contribute' person may soft delete the gallery photos
-- they uploaded themselves. The owning organisation can still change any.

DROP POLICY IF EXISTS machine_photos_update ON machine_photos;
CREATE POLICY machine_photos_update ON machine_photos FOR UPDATE
  USING (tenant_id = current_tenant_id()
    OR (uploaded_by = current_app_user_id()
        AND can_contribute_to_machine(machine_id, tenant_id)))
  WITH CHECK (tenant_id = current_tenant_id()
    OR (uploaded_by = current_app_user_id()
        AND can_contribute_to_machine(machine_id, tenant_id)));

INSERT INTO schema_migrations (version)
VALUES ('0123_machine_photos_delete_own')
ON CONFLICT (version) DO NOTHING;
