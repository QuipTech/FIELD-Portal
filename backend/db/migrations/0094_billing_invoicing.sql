-- Section 8b: FIELD-calculated invoicing through Stripe (test mode first).
-- FIELD works out every amount itself; Stripe only presents the invoice,
-- adds GST and collects payment. No Stripe Subscriptions or Prices, and a
-- webhook only ever updates an invoice's status and totals — never access.
--
-- Replaces 0046's Stripe Subscription sync: its billing tables, the
-- per-tenant app.billing_accounts (one account may now pay for several
-- organisations) and platform.plans.stripe_price_id are removed.

-- ── Retire the Subscription-sync tables ────────────────────────────────
DROP TABLE IF EXISTS billing.stripe_webhook_log;
DROP TABLE IF EXISTS billing.stripe_invoices;
DROP TABLE IF EXISTS billing.stripe_customers;
DROP TABLE IF EXISTS app.billing_accounts;
ALTER TABLE platform.plans DROP COLUMN IF EXISTS stripe_price_id;

-- ── billing: accounts, invoices, webhook events (service role only) ────
CREATE TABLE IF NOT EXISTS billing.billing_accounts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                varchar NOT NULL,
  -- Australian Business Number, 11 digits with no spaces.
  abn                 varchar CHECK (abn ~ '^[0-9]{11}$'),
  billing_email       varchar NOT NULL,
  timezone            varchar NOT NULL DEFAULT 'Australia/Brisbane',
  currency            varchar NOT NULL DEFAULT 'AUD',
  stripe_customer_id  varchar UNIQUE,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  row_version         integer NOT NULL DEFAULT 1,
  deleted_at          timestamptz
);

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS billing_account_id uuid REFERENCES billing.billing_accounts(id);

CREATE INDEX IF NOT EXISTS idx_tenants_billing_account
  ON tenants (billing_account_id) WHERE billing_account_id IS NOT NULL;

-- Money is integer cents. gst_cents/total_cents stay NULL until Stripe
-- has calculated tax on the finalised invoice.
CREATE TABLE IF NOT EXISTS billing.invoices (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_account_id     uuid NOT NULL REFERENCES billing.billing_accounts(id),
  status                 varchar NOT NULL DEFAULT 'draft'
                           CHECK (status IN ('draft', 'final', 'synced', 'paid', 'payment_failed', 'void')),
  currency               varchar NOT NULL,
  stripe_invoice_id      varchar UNIQUE,
  total_ex_gst_cents     bigint NOT NULL CHECK (total_ex_gst_cents >= 0),
  gst_cents              bigint CHECK (gst_cents >= 0),
  total_cents            bigint CHECK (total_cents >= 0),
  amount_paid_cents      bigint NOT NULL DEFAULT 0 CHECK (amount_paid_cents >= 0),
  amount_refunded_cents  bigint NOT NULL DEFAULT 0 CHECK (amount_refunded_cents >= 0),
  hosted_invoice_url     varchar,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  row_version            integer NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_invoices_account_created
  ON billing.invoices (billing_account_id, created_at DESC);

CREATE TABLE IF NOT EXISTS billing.invoice_lines (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id              uuid NOT NULL REFERENCES billing.invoices(id),
  position                integer NOT NULL,
  line_type               varchar NOT NULL,
  description             varchar NOT NULL,
  quantity                integer NOT NULL CHECK (quantity > 0),
  unit_cents              bigint NOT NULL CHECK (unit_cents >= 0),
  amount_cents            bigint NOT NULL CHECK (amount_cents = quantity * unit_cents),
  -- Set once the line is on Stripe, so a retried sync skips it.
  stripe_invoice_item_id  varchar UNIQUE,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  row_version             integer NOT NULL DEFAULT 1,
  UNIQUE (invoice_id, position)
);

-- One row per Stripe event applied; the unique id is what makes a
-- redelivered event a no-op.
CREATE TABLE IF NOT EXISTS billing.stripe_webhook_events (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id  varchar NOT NULL UNIQUE,
  type             varchar NOT NULL,
  processed_at     timestamptz NOT NULL DEFAULT now()
);

DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['billing_accounts', 'invoices', 'invoice_lines'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON billing.%I', 'trg_' || v_table || '_bump_row_version', v_table);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON billing.%I FOR EACH ROW EXECUTE FUNCTION bump_row_version()',
      'trg_' || v_table || '_bump_row_version', v_table);
  END LOOP;
END
$$;

REVOKE ALL ON ALL TABLES IN SCHEMA billing FROM PUBLIC, field_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA billing TO field_service;
-- The billing module lists organisations next to their billing account.
GRANT SELECT ON tenants TO field_service;

-- ── Audited admin writes ───────────────────────────────────────────────
-- Called on the tenant role inside runAuditedChange, so the change and
-- its audit entry share one transaction. NULL = organisation/account not
-- found; an organisation that already has an account is a unique
-- violation (409).
CREATE OR REPLACE FUNCTION admin_create_billing_account(
  p_tenant_id      uuid,
  p_name           varchar,
  p_abn            varchar,
  p_billing_email  varchar,
  p_timezone       varchar
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing uuid;
  v_account_id uuid;
BEGIN
  SELECT billing_account_id INTO v_existing
  FROM tenants WHERE id = p_tenant_id AND deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  IF v_existing IS NOT NULL THEN
    RAISE EXCEPTION 'organisation already has a billing account'
      USING ERRCODE = 'unique_violation';
  END IF;

  INSERT INTO billing.billing_accounts (name, abn, billing_email, timezone)
  VALUES (p_name, p_abn, p_billing_email, p_timezone)
  RETURNING id INTO v_account_id;

  UPDATE tenants SET billing_account_id = v_account_id WHERE id = p_tenant_id;
  RETURN v_account_id;
END;
$$;

-- p_lines: [{ "lineType", "description", "quantity", "unitCents", "amountCents" }]
-- in invoice order. Amounts are calculated by the backend; the
-- invoice_lines CHECK holds them to quantity × unit.
CREATE OR REPLACE FUNCTION admin_create_draft_invoice(
  p_billing_account_id  uuid,
  p_lines               jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_currency varchar;
  v_invoice_id uuid;
BEGIN
  SELECT currency INTO v_currency
  FROM billing.billing_accounts
  WHERE id = p_billing_account_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  INSERT INTO billing.invoices (billing_account_id, currency, total_ex_gst_cents)
  SELECT p_billing_account_id, v_currency, COALESCE(sum((line->>'amountCents')::bigint), 0)
  FROM jsonb_array_elements(p_lines) AS line
  RETURNING id INTO v_invoice_id;

  INSERT INTO billing.invoice_lines
    (invoice_id, position, line_type, description, quantity, unit_cents, amount_cents)
  SELECT v_invoice_id, line.position::integer, line.value->>'lineType', line.value->>'description',
         (line.value->>'quantity')::integer, (line.value->>'unitCents')::bigint,
         (line.value->>'amountCents')::bigint
  FROM jsonb_array_elements(p_lines) WITH ORDINALITY AS line(value, position);

  RETURN v_invoice_id;
END;
$$;

REVOKE ALL ON FUNCTION admin_create_billing_account(uuid, varchar, varchar, varchar, varchar) FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_create_draft_invoice(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_create_billing_account(uuid, varchar, varchar, varchar, varchar) TO field_app;
GRANT EXECUTE ON FUNCTION admin_create_draft_invoice(uuid, jsonb) TO field_app;

INSERT INTO schema_migrations (version)
VALUES ('0094_billing_invoicing')
ON CONFLICT (version) DO NOTHING;
