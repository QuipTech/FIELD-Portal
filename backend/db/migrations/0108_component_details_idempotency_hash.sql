-- Mobile app component detail screen, and Idempotency-Key body checks.

-- A fingerprint of the request body (and uploaded file), so a key reused
-- with a different body is refused (422) instead of replaying the first
-- response. NULL on keys saved before this migration: those still match.
ALTER TABLE idempotency_keys
  ADD COLUMN IF NOT EXISTS request_hash varchar(64);

-- Per-component details the technician sees when tapping a component.
-- All optional; serial_number already exists. last serviced is derived
-- from the component's service/repair history entries.
ALTER TABLE installed_components
  ADD COLUMN IF NOT EXISTS part_number             varchar,
  ADD COLUMN IF NOT EXISTS manufacturer            varchar,
  -- A flagged condition in words, e.g. "Worn" or "Fault code 168-0123".
  ADD COLUMN IF NOT EXISTS condition_note          varchar,
  ADD COLUMN IF NOT EXISTS condition_severity      varchar
    CHECK (condition_severity IS NULL OR condition_severity IN ('ok', 'warning', 'critical')),
  ADD COLUMN IF NOT EXISTS installed_at            timestamptz,
  ADD COLUMN IF NOT EXISTS hours_at_install        integer
    CHECK (hours_at_install IS NULL OR hours_at_install >= 0),
  ADD COLUMN IF NOT EXISTS next_service_due_hours  integer
    CHECK (next_service_due_hours IS NULL OR next_service_due_hours >= 0),
  ADD COLUMN IF NOT EXISTS notes                   text;

INSERT INTO schema_migrations (version)
VALUES ('0108_component_details_idempotency_hash')
ON CONFLICT (version) DO NOTHING;
