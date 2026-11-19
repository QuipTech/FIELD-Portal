-- 30-day account clients are invoiced in Zoho Books, not Stripe.
--
-- 1. Organisations default to the 30-day account (payment_type 'account',
--    approved). Every existing organisation account moves to it too;
--    personal TECH accounts stay on card.
-- 2. For account clients the monthly run writes a billing statement
--    (same lines as an invoice: peak machines, bands, free period, promo)
--    instead of a Stripe invoice. QuipTech exports the month-end report,
--    invoices it in Zoho, and records the Zoho number and the payment here.
-- 3. Statement reminders go to platform administrators; the client is also
--    emailed only when STATEMENT_REMINDERS_EMAIL_CLIENT is on.

-- ── Default: the 30-day account ────────────────────────────────────────
ALTER TABLE billing.billing_accounts ALTER COLUMN account_status SET DEFAULT 'approved';
ALTER TABLE billing.billing_accounts ALTER COLUMN payment_type SET DEFAULT 'account';

DO $$
DECLARE
  v_account record;
  v_tenant_id uuid;
BEGIN
  FOR v_account IN
    SELECT a.id, a.payment_type, a.account_status FROM billing.billing_accounts a
    WHERE a.deleted_at IS NULL AND a.payment_type <> 'account'
      AND NOT EXISTS (SELECT 1 FROM billing.personal_accounts p WHERE p.billing_account_id = a.id)
    FOR UPDATE
  LOOP
    UPDATE billing.billing_accounts
    SET payment_type = 'account', account_status = 'approved',
        approved_at = coalesce(approved_at, now()),
        approval_notes = coalesce(approval_notes, 'Moved to 30-day account (Zoho) by migration 0138'),
        rejected_reason = CASE WHEN account_status = 'rejected' THEN NULL ELSE rejected_reason END,
        updated_at = now()
    WHERE id = v_account.id;
    SELECT t.id INTO v_tenant_id FROM tenants t
    WHERE t.billing_account_id = v_account.id AND t.deleted_at IS NULL
    ORDER BY t.created_at LIMIT 1;
    CONTINUE WHEN v_tenant_id IS NULL;
    PERFORM billing.record_audit_entry(v_tenant_id, NULL, 'update', 'billing_account', v_account.id,
      jsonb_build_object('billingAccountId', v_account.id,
        'from', jsonb_build_object('paymentType', v_account.payment_type, 'accountStatus', v_account.account_status),
        'to', jsonb_build_object('paymentType', 'account', 'accountStatus', 'approved'),
        'reason', '30-day accounts are invoiced in Zoho (migration 0138)'), 'system');
  END LOOP;
END
$$;

-- Personal TECH accounts pay by card: their insert names it, but keep any
-- created before this migration on card too.
UPDATE billing.billing_accounts a SET payment_type = 'card', account_status = 'none'
WHERE a.payment_type = 'account' AND a.approved_at IS NULL
  AND EXISTS (SELECT 1 FROM billing.personal_accounts p WHERE p.billing_account_id = a.id);

-- A monthly draft still in review for an account client would have gone to
-- Stripe: void it, and the next billing run writes that month's statement.
UPDATE billing.invoices i SET status = 'void', review_until = NULL, updated_at = now()
FROM billing.billing_accounts a
WHERE a.id = i.billing_account_id AND a.payment_type = 'account'
  AND i.kind = 'monthly' AND i.status = 'draft' AND i.stripe_invoice_id IS NULL;

-- ── Statements ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS billing.statements (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_account_id     uuid NOT NULL REFERENCES billing.billing_accounts(id),
  -- The billing month: its 1st, and the 1st of the next month.
  period_start           date NOT NULL CHECK (extract(day FROM period_start) = 1),
  period_end             date NOT NULL,
  -- draft: being built (the run, up-front charges). ready: locked for the
  -- month-end report. invoiced_external: invoiced in Zoho. paid. void.
  status                 varchar NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'ready', 'invoiced_external', 'paid', 'void')),
  -- FLD-YYYY-MM-NNNN: the invoice number in the Zoho import.
  reference              varchar(40) NOT NULL UNIQUE,
  po_number              varchar(140),
  subtotal_ex_gst_cents  bigint NOT NULL DEFAULT 0 CHECK (subtotal_ex_gst_cents >= 0),
  gst_cents              bigint NOT NULL DEFAULT 0 CHECK (gst_cents >= 0),
  total_inc_gst_cents    bigint NOT NULL DEFAULT 0 CHECK (total_inc_gst_cents >= 0),
  -- Set once the run has added the month's machine charges.
  run_at                 timestamptz,
  ready_at               timestamptz,
  ready_by               uuid REFERENCES users(id) ON DELETE SET NULL,
  terms_days             integer CHECK (terms_days BETWEEN 1 AND 120),
  zoho_invoice_number    varchar(60),
  zoho_invoice_date      date,
  -- zoho_invoice_date + terms_days.
  due_on                 date,
  invoiced_at            timestamptz,
  invoiced_by            uuid REFERENCES users(id) ON DELETE SET NULL,
  paid_on                date,
  paid_reference         varchar(140),
  paid_at                timestamptz,
  paid_by                uuid REFERENCES users(id) ON DELETE SET NULL,
  void_reason            text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  row_version            integer NOT NULL DEFAULT 1,
  CHECK (period_end > period_start),
  CHECK (status NOT IN ('invoiced_external', 'paid') OR
         (zoho_invoice_number IS NOT NULL AND zoho_invoice_date IS NOT NULL AND due_on IS NOT NULL)),
  CHECK (status <> 'paid' OR paid_on IS NOT NULL),
  CHECK (status <> 'void' OR length(trim(coalesce(void_reason, ''))) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_statements_account_month
  ON billing.statements (billing_account_id, period_start) WHERE status <> 'void';
CREATE INDEX IF NOT EXISTS idx_statements_month
  ON billing.statements (period_start, status);
CREATE INDEX IF NOT EXISTS idx_statements_due
  ON billing.statements (due_on) WHERE status = 'invoiced_external';

CREATE TABLE IF NOT EXISTS billing.statement_lines (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  statement_id   uuid NOT NULL REFERENCES billing.statements(id) ON DELETE CASCADE,
  position       integer NOT NULL,
  line_type      varchar NOT NULL,
  description    text NOT NULL,
  quantity       integer NOT NULL CHECK (quantity > 0),
  unit_cents     bigint NOT NULL,
  amount_cents   bigint NOT NULL,
  calc_snapshot  jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (statement_id, position),
  CHECK (amount_cents = quantity * unit_cents),
  CHECK (CASE WHEN line_type IN ('FREE_PERIOD_DISCOUNT', 'PROMO_DISCOUNT')
              THEN unit_cents <= 0 AND quantity = 1
              ELSE unit_cents >= 0 END)
);

-- A month marked ready: its statements are locked for the report.
CREATE TABLE IF NOT EXISTS billing.statement_months (
  period_start  date PRIMARY KEY CHECK (extract(day FROM period_start) = 1),
  locked_at     timestamptz NOT NULL DEFAULT now(),
  locked_by     uuid REFERENCES users(id) ON DELETE SET NULL
);

-- One row per reminder sent, by days from the due date.
CREATE TABLE IF NOT EXISTS billing.statement_reminders (
  statement_id  uuid NOT NULL REFERENCES billing.statements(id) ON DELETE CASCADE,
  offset_days   integer NOT NULL,
  sent_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (statement_id, offset_days)
);

DROP TRIGGER IF EXISTS trg_statements_bump_row_version ON billing.statements;
CREATE TRIGGER trg_statements_bump_row_version BEFORE UPDATE ON billing.statements
  FOR EACH ROW EXECUTE FUNCTION bump_row_version();

DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['statements', 'statement_lines', 'statement_months', 'statement_reminders'] LOOP
    EXECUTE format('ALTER TABLE billing.%I ENABLE ROW LEVEL SECURITY', v_table);
    EXECUTE format('ALTER TABLE billing.%I FORCE ROW LEVEL SECURITY', v_table);
    EXECUTE format('DROP POLICY IF EXISTS %I ON billing.%I', v_table || '_service_all', v_table);
    EXECUTE format('CREATE POLICY %I ON billing.%I FOR ALL TO field_service USING (true) WITH CHECK (true)',
      v_table || '_service_all', v_table);
  END LOOP;
END
$$;

REVOKE ALL ON billing.statements, billing.statement_lines, billing.statement_months,
  billing.statement_reminders FROM PUBLIC, field_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON billing.statements, billing.statement_lines,
  billing.statement_months, billing.statement_reminders TO field_service;

INSERT INTO billing.config (key, value, is_final, description) VALUES
  ('STATEMENT_REMINDERS_EMAIL_CLIENT', 'false', true,
   'Also email 30-day account clients their statement reminders. Off: reminders go to platform administrators only')
ON CONFLICT (key) DO NOTHING;

INSERT INTO schema_migrations (version)
VALUES ('0138_billing_statements')
ON CONFLICT (version) DO NOTHING;
