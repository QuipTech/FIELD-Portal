-- A refunded or void personal invoice no longer blocks the month: the
-- period is marked replaced and the user can confirm a fresh invoice.
-- Replaced periods stay for the user's invoice history and the audit trail,
-- so uniqueness only applies to the current (not replaced) period.
ALTER TABLE billing.personal_periods
  ADD COLUMN IF NOT EXISTS replaced_at timestamptz;

ALTER TABLE billing.personal_periods
  DROP CONSTRAINT IF EXISTS personal_periods_user_id_period_start_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_personal_periods_current
  ON billing.personal_periods (user_id, period_start)
  WHERE replaced_at IS NULL AND deleted_at IS NULL;

INSERT INTO schema_migrations (version)
VALUES ('0099_personal_period_replacement')
ON CONFLICT (version) DO NOTHING;
