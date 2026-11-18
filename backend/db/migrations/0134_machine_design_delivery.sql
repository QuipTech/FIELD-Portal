CREATE TABLE IF NOT EXISTS mc_design_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  name text NOT NULL,
  UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS mc_design_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES mc_design_projects(id),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  files jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mc_design_versions_project
  ON mc_design_versions (project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS mc_design_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES mc_design_versions(id),
  project_id uuid NOT NULL REFERENCES mc_design_projects(id),
  sender_tenant_id uuid NOT NULL REFERENCES tenants(id),
  device_tenant_id uuid NOT NULL REFERENCES tenants(id),
  device_id uuid NOT NULL REFERENCES mc_devices(id),
  machine_id uuid NOT NULL REFERENCES machines(id),
  machine_label text NOT NULL,
  project_name text NOT NULL,
  site text,
  batch_id uuid NOT NULL,
  preview_hash text NOT NULL,
  status text NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting', 'downloading', 'arrived', 'failed')),
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sender_tenant_id, batch_id, machine_id)
);
CREATE INDEX IF NOT EXISTS idx_mc_design_delivery_device
  ON mc_design_deliveries (device_id, created_at, id);
CREATE INDEX IF NOT EXISTS idx_mc_design_delivery_project_machine
  ON mc_design_deliveries (project_id, machine_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_mc_design_delivery_version
  ON mc_design_deliveries (version_id, device_tenant_id);

ALTER TABLE mc_design_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE mc_design_projects FORCE ROW LEVEL SECURITY;
ALTER TABLE mc_design_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mc_design_versions FORCE ROW LEVEL SECURITY;
ALTER TABLE mc_design_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE mc_design_deliveries FORCE ROW LEVEL SECURITY;

CREATE POLICY mc_design_projects_owner ON mc_design_projects
  USING (tenant_id = current_tenant_id());
CREATE POLICY mc_design_versions_owner ON mc_design_versions
  USING (tenant_id = current_tenant_id());
CREATE POLICY mc_design_versions_recipient ON mc_design_versions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM mc_design_deliveries d
    WHERE d.version_id = mc_design_versions.id AND d.device_tenant_id = current_tenant_id()
  ));
CREATE POLICY mc_design_deliveries_read ON mc_design_deliveries FOR SELECT
  USING (sender_tenant_id = current_tenant_id() OR device_tenant_id = current_tenant_id());
CREATE POLICY mc_design_deliveries_send ON mc_design_deliveries FOR INSERT
  WITH CHECK (sender_tenant_id = current_tenant_id());
CREATE POLICY mc_design_deliveries_update ON mc_design_deliveries FOR UPDATE
  USING (device_tenant_id = current_tenant_id())
  WITH CHECK (device_tenant_id = current_tenant_id());

GRANT SELECT, INSERT ON mc_design_projects, mc_design_versions, mc_design_deliveries TO field_app;
GRANT UPDATE (status, error, updated_at) ON mc_design_deliveries TO field_app;

INSERT INTO schema_migrations (version)
VALUES ('0134_machine_design_delivery')
ON CONFLICT (version) DO NOTHING;
