-- Section 2e: machine status history, for the dashboard's fleet uptime.
-- Every change to machines.status (and every new machine) writes a row,
-- from a trigger so no code path can skip it. Tracking starts when this
-- migration runs: each existing machine gets one row for its current
-- status, stamped now(), and weeks before that have no uptime figure.
--
-- changed_by comes from app.user_id, which the backend sets in the
-- transaction that changes the status (NULL for rows written elsewhere).

CREATE TABLE IF NOT EXISTS machine_status_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  machine_id  uuid NOT NULL REFERENCES machines(id),
  status      varchar NOT NULL CHECK (status IN ('running', 'down', 'service_due')),
  -- SET NULL so delete_user_account() can still hard-delete the user.
  changed_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  changed_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_machine_status_events_tenant_changed
  ON machine_status_events (tenant_id, changed_at);
CREATE INDEX IF NOT EXISTS idx_machine_status_events_machine_changed
  ON machine_status_events (machine_id, changed_at);

ALTER TABLE machine_status_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE machine_status_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS machine_status_events_select ON machine_status_events;
CREATE POLICY machine_status_events_select ON machine_status_events
  FOR SELECT USING (tenant_id = current_tenant_id());

-- History is append-only: the trigger is the only writer, so field_app
-- needs no INSERT/UPDATE/DELETE of its own.
REVOKE INSERT, UPDATE, DELETE ON machine_status_events FROM field_app;

-- SECURITY DEFINER so the insert works whatever role changed the machine.
CREATE OR REPLACE FUNCTION record_machine_status_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO machine_status_events (tenant_id, machine_id, status, changed_by)
    VALUES (NEW.tenant_id, NEW.id, NEW.status,
            NULLIF(current_setting('app.user_id', true), '')::uuid);
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_machines_record_status_event ON machines;
CREATE TRIGGER trg_machines_record_status_event
  AFTER INSERT OR UPDATE OF status ON machines
  FOR EACH ROW EXECUTE FUNCTION record_machine_status_event();

-- Starting point for machines that existed before tracking began.
INSERT INTO machine_status_events (tenant_id, machine_id, status)
SELECT m.tenant_id, m.id, m.status
FROM machines m
WHERE NOT EXISTS (
  SELECT 1 FROM machine_status_events e WHERE e.machine_id = m.id
);

INSERT INTO schema_migrations (version)
VALUES ('0053_machine_status_events')
ON CONFLICT (version) DO NOTHING;
