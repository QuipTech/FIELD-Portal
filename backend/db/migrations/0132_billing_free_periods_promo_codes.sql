-- Free periods and promo codes, applied by one discount step in the
-- monthly run: the free period first, then the promo, never below A$0.
-- Discounts are negative invoice lines (Stripe gets negative invoice
-- items); no Stripe coupons or subscriptions.

-- ── Free period (set by a platform administrator) ──────────────────────
-- The month containing free_until is the last discounted month; normal
-- billing starts the month after, with no back billing.
ALTER TABLE billing.billing_accounts
  ADD COLUMN IF NOT EXISTS free_until date,
  ADD COLUMN IF NOT EXISTS free_percent smallint NOT NULL DEFAULT 100
    CHECK (free_percent BETWEEN 1 AND 100),
  ADD COLUMN IF NOT EXISTS free_reason text,
  ADD COLUMN IF NOT EXISTS free_set_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS free_set_at timestamptz;

ALTER TABLE billing.billing_accounts DROP CONSTRAINT IF EXISTS billing_accounts_free_reason;
ALTER TABLE billing.billing_accounts ADD CONSTRAINT billing_accounts_free_reason
  CHECK (free_until IS NULL OR length(trim(coalesce(free_reason, ''))) > 0);

-- ── Promo codes ────────────────────────────────────────────────────────
-- Platform-wide; read only through the API (service role), so a customer
-- can't list codes. valid_from/valid_until are inclusive calendar days in
-- the redeeming account's time zone.
CREATE TABLE IF NOT EXISTS billing.promo_codes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                varchar(40) NOT NULL CHECK (code ~ '^[A-Za-z0-9_-]{3,40}$'),
  description         text NOT NULL CHECK (length(trim(description)) > 0),
  discount_type       varchar NOT NULL CHECK (discount_type IN ('percent', 'fixed_cents')),
  -- percent: 1–100. fixed_cents: cents off the machine charges each month.
  discount_value      integer NOT NULL CHECK (discount_value > 0),
  -- NULL = every month for as long as the account has it.
  duration_months     integer CHECK (duration_months > 0),
  valid_from          date,
  valid_until         date,
  max_redemptions     integer CHECK (max_redemptions > 0),
  redemptions_count   integer NOT NULL DEFAULT 0 CHECK (redemptions_count >= 0),
  new_customers_only  boolean NOT NULL DEFAULT false,
  active              boolean NOT NULL DEFAULT true,
  created_by          uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  row_version         integer NOT NULL DEFAULT 1,
  deleted_at          timestamptz,
  CHECK (discount_type <> 'percent' OR discount_value <= 100),
  CHECK (valid_from IS NULL OR valid_until IS NULL OR valid_from <= valid_until),
  CHECK (max_redemptions IS NULL OR redemptions_count <= max_redemptions)
);

-- Case-insensitive: SPRING25 and spring25 are the same code.
CREATE UNIQUE INDEX IF NOT EXISTS uq_promo_codes_code
  ON billing.promo_codes (lower(code)) WHERE deleted_at IS NULL;

-- starts_month/ends_month are the first day of the first and last
-- discounted months (inclusive); ends_month NULL = no end. One account
-- redeems a code once; "one active promo per account" is checked under a
-- lock by the service, since "active" depends on today's date.
CREATE TABLE IF NOT EXISTS billing.promo_redemptions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id       uuid NOT NULL REFERENCES billing.promo_codes(id),
  billing_account_id  uuid NOT NULL REFERENCES billing.billing_accounts(id),
  redeemed_by         uuid REFERENCES users(id) ON DELETE SET NULL,
  redeemed_at         timestamptz NOT NULL DEFAULT now(),
  starts_month        date NOT NULL CHECK (extract(day FROM starts_month) = 1),
  ends_month          date CHECK (ends_month IS NULL OR extract(day FROM ends_month) = 1),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  row_version         integer NOT NULL DEFAULT 1,
  deleted_at          timestamptz,
  UNIQUE (promo_code_id, billing_account_id),
  CHECK (ends_month IS NULL OR ends_month >= starts_month)
);

CREATE INDEX IF NOT EXISTS idx_promo_redemptions_account
  ON billing.promo_redemptions (billing_account_id, starts_month DESC)
  WHERE deleted_at IS NULL;

DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['promo_codes', 'promo_redemptions'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON billing.%I', 'trg_' || v_table || '_bump_row_version', v_table);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON billing.%I FOR EACH ROW EXECUTE FUNCTION bump_row_version()',
      'trg_' || v_table || '_bump_row_version', v_table);
    EXECUTE format('ALTER TABLE billing.%I ENABLE ROW LEVEL SECURITY', v_table);
    EXECUTE format('ALTER TABLE billing.%I FORCE ROW LEVEL SECURITY', v_table);
    EXECUTE format('DROP POLICY IF EXISTS %I ON billing.%I', v_table || '_service_all', v_table);
    EXECUTE format('CREATE POLICY %I ON billing.%I FOR ALL TO field_service USING (true) WITH CHECK (true)',
      v_table || '_service_all', v_table);
  END LOOP;
END
$$;

-- An organisation reads its own redemptions; promo codes stay service-only.
DROP POLICY IF EXISTS promo_redemptions_own_select ON billing.promo_redemptions;
CREATE POLICY promo_redemptions_own_select ON billing.promo_redemptions
  FOR SELECT TO field_app USING (billing_account_id = current_billing_account_id());

REVOKE ALL ON billing.promo_codes, billing.promo_redemptions FROM PUBLIC, field_app;
GRANT SELECT ON billing.promo_redemptions TO field_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON billing.promo_codes, billing.promo_redemptions TO field_service;

-- ── Discount lines ─────────────────────────────────────────────────────
-- A discount line is quantity 1 with a negative unit price. Every other
-- line stays non-negative. The invoice total is still never below 0.
DO $$
DECLARE
  v_name text;
BEGIN
  FOR v_name IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'billing.invoice_lines'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%unit_cents >= 0%'
  LOOP
    EXECUTE format('ALTER TABLE billing.invoice_lines DROP CONSTRAINT %I', v_name);
  END LOOP;
END
$$;

ALTER TABLE billing.invoice_lines DROP CONSTRAINT IF EXISTS invoice_lines_unit_cents_sign;
ALTER TABLE billing.invoice_lines ADD CONSTRAINT invoice_lines_unit_cents_sign CHECK (
  CASE WHEN line_type IN ('FREE_PERIOD_DISCOUNT', 'PROMO_DISCOUNT')
       THEN unit_cents <= 0 AND quantity = 1
       ELSE unit_cents >= 0 END
);

INSERT INTO schema_migrations (version)
VALUES ('0132_billing_free_periods_promo_codes')
ON CONFLICT (version) DO NOTHING;
