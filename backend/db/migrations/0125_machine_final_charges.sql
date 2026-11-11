-- A machine being deleted pays for the days it was used this month, at the
-- daily rate, instead of counting in the month's peak (approved exception to
-- billing spec section 3, rule 3). The month-end run leaves out any machine with
-- a charge here whose invoice isn't void, so it is never billed twice.

ALTER TABLE billing.invoices DROP CONSTRAINT IF EXISTS invoices_kind_check;
ALTER TABLE billing.invoices ADD CONSTRAINT invoices_kind_check
  CHECK (kind IN ('monthly', 'annual', 'onboarding', 'personal', 'manual', 'machine_final'));

CREATE TABLE IF NOT EXISTS billing.machine_final_charges (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id          uuid NOT NULL REFERENCES machines(id),
  billing_account_id  uuid NOT NULL REFERENCES billing.billing_accounts(id),
  invoice_id          uuid NOT NULL UNIQUE REFERENCES billing.invoices(id),
  -- The first day of the month charged for.
  period_start        date NOT NULL,
  last_used_on        date NOT NULL,
  days_used           integer NOT NULL CHECK (days_used > 0),
  days_in_month       integer NOT NULL CHECK (days_in_month BETWEEN 28 AND 31),
  rate_cents          bigint NOT NULL CHECK (rate_cents >= 0),
  amount_cents        bigint NOT NULL CHECK (amount_cents >= 0),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  row_version         integer NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_machine_final_charges_machine
  ON billing.machine_final_charges (machine_id, period_start);
CREATE INDEX IF NOT EXISTS idx_machine_final_charges_account
  ON billing.machine_final_charges (billing_account_id, period_start);

DROP TRIGGER IF EXISTS trg_machine_final_charges_bump_row_version ON billing.machine_final_charges;
CREATE TRIGGER trg_machine_final_charges_bump_row_version
  BEFORE UPDATE ON billing.machine_final_charges
  FOR EACH ROW EXECUTE FUNCTION bump_row_version();

ALTER TABLE billing.machine_final_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing.machine_final_charges FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS machine_final_charges_own_select ON billing.machine_final_charges;
CREATE POLICY machine_final_charges_own_select ON billing.machine_final_charges
  FOR SELECT TO field_app USING (billing_account_id = current_billing_account_id());
DROP POLICY IF EXISTS machine_final_charges_service_all ON billing.machine_final_charges;
CREATE POLICY machine_final_charges_service_all ON billing.machine_final_charges
  FOR ALL TO field_service USING (true) WITH CHECK (true);

REVOKE ALL ON billing.machine_final_charges FROM PUBLIC, field_app;
GRANT SELECT ON billing.machine_final_charges TO field_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON billing.machine_final_charges TO field_service;

INSERT INTO schema_migrations (version)
VALUES ('0125_machine_final_charges')
ON CONFLICT (version) DO NOTHING;
