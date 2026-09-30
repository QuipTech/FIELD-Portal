-- Section 2d: the portal's Machines list. A machine gets the site it
-- works at and its hour-meter reading, and `status` becomes its operating
-- status — running, down or service due — which the list, the "down"
-- banner and the history header show. Class comes from the model
-- (machine_models.product_family), so it isn't stored per machine.

ALTER TABLE machines
  ADD COLUMN IF NOT EXISTS site varchar,
  ADD COLUMN IF NOT EXISTS operating_hours integer;

-- 'active' was the only value written before; it meant "in service".
UPDATE machines SET status = 'running' WHERE status = 'active';
ALTER TABLE machines ALTER COLUMN status SET DEFAULT 'running';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'machines_status_check') THEN
    ALTER TABLE machines ADD CONSTRAINT machines_status_check
      CHECK (status IN ('running', 'down', 'service_due'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'machines_operating_hours_check') THEN
    ALTER TABLE machines ADD CONSTRAINT machines_operating_hours_check
      CHECK (operating_hours IS NULL OR operating_hours >= 0);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_machines_tenant_status
  ON machines (tenant_id, status) WHERE deleted_at IS NULL;

INSERT INTO schema_migrations (version)
VALUES ('0052_machine_fleet_fields')
ON CONFLICT (version) DO NOTHING;
