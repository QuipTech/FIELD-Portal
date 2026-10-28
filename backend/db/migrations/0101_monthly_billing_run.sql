-- ── Monthly billing run (billing spec sections 3 and 9) ────────────────
-- daily_billable_counts: one snapshot per billing account and billing day
-- (account time zone). The month's peak is the max of these rows. Counts
-- come from activation and seat intervals, which keep their history, so a
-- missed night is backfilled with the same numbers.
CREATE TABLE IF NOT EXISTS billing.daily_billable_counts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_account_id  uuid NOT NULL REFERENCES billing.billing_accounts(id),
  day                 date NOT NULL,
  active_machines     integer NOT NULL CHECK (active_machines >= 0),
  tech_seats          integer NOT NULL CHECK (tech_seats >= 0),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  row_version         integer NOT NULL DEFAULT 1,
  deleted_at          timestamptz,
  UNIQUE (billing_account_id, day)
);

-- Invoices from the run carry their billing month and a review window.
-- Personal and test invoices leave these null and are finalised at once.
ALTER TABLE billing.invoices
  ADD COLUMN IF NOT EXISTS period_start date,
  ADD COLUMN IF NOT EXISTS period_end date,
  ADD COLUMN IF NOT EXISTS review_until timestamptz,
  ADD COLUMN IF NOT EXISTS held_at timestamptz,
  ADD COLUMN IF NOT EXISTS held_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS hold_reason text;

-- One run invoice per account and month: a re-run never bills twice.
CREATE UNIQUE INDEX IF NOT EXISTS uq_invoices_account_period
  ON billing.invoices (billing_account_id, period_start)
  WHERE period_start IS NOT NULL AND status <> 'void';

CREATE INDEX IF NOT EXISTS idx_invoices_review_due
  ON billing.invoices (review_until)
  WHERE status = 'draft' AND period_start IS NOT NULL;

-- Peak, the day it occurred and the price book used, so a finalised line
-- can be recalculated to the cent (acceptance test T31).
ALTER TABLE billing.invoice_lines
  ADD COLUMN IF NOT EXISTS calc_snapshot jsonb;

ALTER TABLE billing.daily_billable_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing.daily_billable_counts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS daily_billable_counts_own_select ON billing.daily_billable_counts;
CREATE POLICY daily_billable_counts_own_select ON billing.daily_billable_counts
  FOR SELECT TO field_app USING (billing_account_id = current_billing_account_id());
DROP POLICY IF EXISTS daily_billable_counts_service_all ON billing.daily_billable_counts;
CREATE POLICY daily_billable_counts_service_all ON billing.daily_billable_counts
  FOR ALL TO field_service USING (true) WITH CHECK (true);
DROP TRIGGER IF EXISTS daily_billable_counts_bump_row_version ON billing.daily_billable_counts;
CREATE TRIGGER daily_billable_counts_bump_row_version
  BEFORE UPDATE ON billing.daily_billable_counts
  FOR EACH ROW EXECUTE FUNCTION bump_row_version();

GRANT SELECT ON billing.daily_billable_counts TO field_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON billing.daily_billable_counts TO field_service;

INSERT INTO schema_migrations (version)
VALUES ('0101_monthly_billing_run')
ON CONFLICT (version) DO NOTHING;
