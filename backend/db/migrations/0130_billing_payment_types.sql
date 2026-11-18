-- Billing for active machines only, paid by card or on a 30-day account.
--
-- 1. No user paywall: REQUIRE_USER_SUBSCRIPTION (default false) turns the
--    personal A$49 TECH payment and the organisation TECH seat charge off.
-- 2. Payment type per billing account: card (Stripe charges a saved card)
--    or account (approved by a platform administrator; Stripe sends the
--    invoice with terms_days to pay by bank transfer).
-- 3. Account invoices carry bank details and a PO number; a platform
--    administrator marks them paid when the money arrives.
-- 4. Configurable reminders before and after the due date, and a credit
--    limit warning. Suspension stays a manual decision.

-- ── Payment type and the 30-day account application ────────────────────
ALTER TABLE billing.billing_accounts
  ADD COLUMN IF NOT EXISTS payment_type varchar NOT NULL DEFAULT 'card'
    CHECK (payment_type IN ('card', 'account')),
  -- none: never applied. pending: waiting for a platform administrator.
  -- on_hold: the administrator needs more information. approved/rejected:
  -- decided. Invoices use account terms only while approved.
  ADD COLUMN IF NOT EXISTS account_status varchar NOT NULL DEFAULT 'none'
    CHECK (account_status IN ('none', 'pending', 'approved', 'rejected', 'on_hold')),
  ADD COLUMN IF NOT EXISTS terms_days integer NOT NULL DEFAULT 30
    CHECK (terms_days BETWEEN 1 AND 120),
  -- NULL = no limit. Going over it only warns; nothing is ever blocked.
  ADD COLUMN IF NOT EXISTS credit_limit_cents bigint CHECK (credit_limit_cents >= 0),
  ADD COLUMN IF NOT EXISTS po_required boolean NOT NULL DEFAULT false,
  -- The organisation's standing PO number; an invoice's own PO wins.
  ADD COLUMN IF NOT EXISTS default_po_number varchar(140),
  ADD COLUMN IF NOT EXISTS account_legal_name varchar,
  ADD COLUMN IF NOT EXISTS accounts_email varchar,
  ADD COLUMN IF NOT EXISTS accounts_phone varchar,
  ADD COLUMN IF NOT EXISTS application_notes text,
  ADD COLUMN IF NOT EXISTS applied_at timestamptz,
  ADD COLUMN IF NOT EXISTS applied_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approval_notes text,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejected_reason text,
  -- Set when platform administrators were warned the unpaid balance is
  -- over the credit limit; cleared once it is back under, so the next
  -- crossing warns again.
  ADD COLUMN IF NOT EXISTS credit_limit_warned_at timestamptz;

-- Account terms need an approved application.
ALTER TABLE billing.billing_accounts DROP CONSTRAINT IF EXISTS billing_accounts_account_needs_approval;
ALTER TABLE billing.billing_accounts ADD CONSTRAINT billing_accounts_account_needs_approval
  CHECK (payment_type = 'card' OR account_status = 'approved');

ALTER TABLE billing.billing_accounts DROP CONSTRAINT IF EXISTS billing_accounts_rejection_reason;
ALTER TABLE billing.billing_accounts ADD CONSTRAINT billing_accounts_rejection_reason
  CHECK (account_status <> 'rejected' OR length(trim(coalesce(rejected_reason, ''))) > 0);

CREATE INDEX IF NOT EXISTS idx_billing_accounts_account_status
  ON billing.billing_accounts (account_status, applied_at)
  WHERE account_status <> 'none' AND deleted_at IS NULL;

-- ── Invoices: PO number, collection method, paid out of band ───────────
ALTER TABLE billing.invoices
  ADD COLUMN IF NOT EXISTS po_number varchar(140),
  -- How Stripe collects it, saved when it's pushed: a saved card is charged
  -- (charge_automatically) or the customer is sent the invoice to pay.
  ADD COLUMN IF NOT EXISTS collection_method varchar
    CHECK (collection_method IN ('charge_automatically', 'send_invoice')),
  ADD COLUMN IF NOT EXISTS marked_paid_on date,
  ADD COLUMN IF NOT EXISTS marked_paid_method varchar
    CHECK (marked_paid_method IN ('bank_transfer', 'cheque', 'cash', 'other')),
  ADD COLUMN IF NOT EXISTS marked_paid_reference varchar(200),
  ADD COLUMN IF NOT EXISTS marked_paid_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS marked_paid_at timestamptz,
  -- Why a finished invoice was never sent to Stripe (e.g. a free period
  -- brought it to A$0).
  ADD COLUMN IF NOT EXISTS no_charge_reason varchar
    CHECK (no_charge_reason IN ('fully_discounted'));

-- ── Reminders ──────────────────────────────────────────────────────────
-- One row per reminder sent, keyed by its offset from the due date
-- (negative = before), so each is sent once even with several containers.
CREATE TABLE IF NOT EXISTS billing.invoice_reminders (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id          uuid NOT NULL REFERENCES billing.invoices(id),
  billing_account_id  uuid NOT NULL REFERENCES billing.billing_accounts(id),
  offset_days         integer NOT NULL,
  sent_at             timestamptz NOT NULL DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  row_version         integer NOT NULL DEFAULT 1,
  UNIQUE (invoice_id, offset_days)
);

CREATE INDEX IF NOT EXISTS idx_invoice_reminders_account
  ON billing.invoice_reminders (billing_account_id, sent_at DESC);

DROP TRIGGER IF EXISTS trg_invoice_reminders_bump_row_version ON billing.invoice_reminders;
CREATE TRIGGER trg_invoice_reminders_bump_row_version
  BEFORE UPDATE ON billing.invoice_reminders
  FOR EACH ROW EXECUTE FUNCTION bump_row_version();

ALTER TABLE billing.invoice_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing.invoice_reminders FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS invoice_reminders_own_select ON billing.invoice_reminders;
CREATE POLICY invoice_reminders_own_select ON billing.invoice_reminders
  FOR SELECT TO field_app USING (billing_account_id = current_billing_account_id());
DROP POLICY IF EXISTS invoice_reminders_service_all ON billing.invoice_reminders;
CREATE POLICY invoice_reminders_service_all ON billing.invoice_reminders
  FOR ALL TO field_service USING (true) WITH CHECK (true);
GRANT SELECT ON billing.invoice_reminders TO field_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON billing.invoice_reminders TO field_service;

-- ── Configuration ──────────────────────────────────────────────────────
-- Bank details start empty: an account invoice leaves them out until a
-- platform administrator fills them in (Admin → Billing → Prices &
-- settings). PAYMENT_REFERENCE_FORMAT may use {invoiceRef} (the first 8
-- characters of the FIELD invoice id) and {accountName}.
INSERT INTO billing.config (key, value, is_final, description) VALUES
  ('REQUIRE_USER_SUBSCRIPTION', 'false', true,
   'Whether every non-Owner pays a personal TECH subscription and organisations pay for TECH seats. Off: billing is for active machines only'),
  ('ACCOUNT_DEFAULT_TERMS_DAYS', '30', true,
   'Payment terms offered when a 30-day account is approved'),
  ('BANK_ACCOUNT_NAME', '""', false,
   'Bank account name printed on account invoices'),
  ('BANK_BSB', '""', false,
   'BSB printed on account invoices'),
  ('BANK_ACCOUNT_NUMBER', '""', false,
   'Bank account number printed on account invoices'),
  ('PAYMENT_REFERENCE_FORMAT', '"FIELD-{invoiceRef}"', false,
   'Payment reference printed on account invoices; {invoiceRef} and {accountName} are filled in'),
  ('INVOICE_REMINDER_OFFSET_DAYS', '[-7, 0, 7, 14]', true,
   'Days from the due date to send reminders (negative = before). Invoices charged to a card only get the ones on or after the due date')
ON CONFLICT (key) DO NOTHING;

INSERT INTO schema_migrations (version)
VALUES ('0130_billing_payment_types')
ON CONFLICT (version) DO NOTHING;
