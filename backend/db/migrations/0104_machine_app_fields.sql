-- Section 2e: what the mobile app needs on machines.
--   * machines.cover_photo_id: the gallery photo shown for the machine; the
--     newest gallery photo when unset (or when the chosen one is removed)
--   * machine_assignments: technicians assigned to a machine. "My machines"
--     in the app is a technician's assigned machines once they have any.
--   * configuration snapshots gain two triggers for restoring a snapshot:
--     'before_restore' (the configuration being replaced) and 'restored'

ALTER TABLE machines
  ADD COLUMN IF NOT EXISTS cover_photo_id uuid REFERENCES machine_photos(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS machine_assignments (
  tenant_id    uuid NOT NULL REFERENCES tenants(id),
  machine_id   uuid NOT NULL REFERENCES machines(id),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- SET NULL so delete_user_account() can still hard-delete the assigner.
  assigned_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (machine_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_machine_assignments_user
  ON machine_assignments (tenant_id, user_id);

ALTER TABLE machine_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE machine_assignments FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS machine_assignments_all ON machine_assignments;
CREATE POLICY machine_assignments_all ON machine_assignments
  FOR ALL USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
GRANT SELECT, INSERT, DELETE ON machine_assignments TO field_app;

ALTER TABLE configuration_snapshots DROP CONSTRAINT IF EXISTS configuration_snapshots_trigger_check;
ALTER TABLE configuration_snapshots ADD CONSTRAINT configuration_snapshots_trigger_check
  CHECK (trigger IN ('manual', 'service', 'component_replaced', 'scheduled', 'baseline',
                     'before_restore', 'restored'));

INSERT INTO schema_migrations (version)
VALUES ('0104_machine_app_fields')
ON CONFLICT (version) DO NOTHING;
