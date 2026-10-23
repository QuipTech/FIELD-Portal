-- Section 8c: billing config, plan codes and the versioned price book
-- (FIELD billing spec sections 2, 3 and 11). Nothing here is read by
-- application logic as a literal: prices and bands live in the price book
-- (pinned to a subscription at sign-up and renewal), every other value in
-- billing.config, editable without a deploy.

-- ── Config store (spec section 11, minus the prices) ───────────────────
-- value is jsonb so one table holds integers, ratios, a time zone and
-- "off" (JSON null). is_final = false marks a placeholder still waiting on
-- real usage data; the portal tags it "not final".
CREATE TABLE IF NOT EXISTS billing.config (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key          varchar NOT NULL UNIQUE,
  value        jsonb NOT NULL,
  is_final     boolean NOT NULL,
  description  text NOT NULL,
  updated_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  row_version  integer NOT NULL DEFAULT 1,
  deleted_at   timestamptz
);

-- The AI, storage and ingest allowances are TBD in the spec: these
-- placeholders keep the allowance maths running until the first customer
-- sites' usage sets them.
INSERT INTO billing.config (key, value, is_final, description) VALUES
  ('ENTERPRISE_THRESHOLD_MACHINES', '500', true,
   'Active machines at which a self-serve account raises a sales review task (activation is never refused)'),
  ('ANNUAL_MONTHS_CHARGED', '10', true,
   'Months charged up front for an annual prepaid term of 12 months'),
  ('REMOTE_BLOCK_MINUTES', '15', true,
   'Length of one billable remote session block, in minutes'),
  ('REMOTE_MIN_SECONDS', '120', true,
   'Remote sessions shorter than this are metered but not charged'),
  ('AI_ALLOWANCE_PER_ACTIVE_MACHINE', '100', false,
   'AI turns per month per average active machine, pooled across the billing account'),
  ('AI_ALLOWANCE_PER_TECH_USER', '300', false,
   'AI turns per month per TECH seat, pooled across the billing account'),
  ('AI_NOTIFY_THRESHOLD', '0.8', true,
   'Share of an allowance at which organisation administrators are notified'),
  ('AI_FLAG_THRESHOLD', '1.0', true,
   'Share of an allowance at which administrators and QuipTech are notified and the account is flagged'),
  ('AI_ABUSE_CEILING_MULTIPLIER', 'null', true,
   'Multiple of the AI allowance above which new sessions may be refused; null = off'),
  ('STORAGE_ALLOWANCE_PER_ACTIVE_MACHINE', '5368709120', false,
   'Stored bytes per average active machine, pooled across the billing account'),
  ('INGEST_ALLOWANCE', '500', false,
   'Document pages ingested per month per average active machine, pooled across the billing account'),
  ('PARTNER_DEFAULT_MARGIN_BPS', '2500', false,
   'Default partner margin in basis points (2500 = 25%) for a new partner agreement'),
  ('PAYMENT_TERMS_DAYS', '14', true,
   'Days until an emailed invoice is due'),
  ('INVOICE_REVIEW_HOURS', '24', true,
   'Hours a monthly draft invoice waits for review before it is finalised'),
  ('DEFAULT_BILLING_TIMEZONE', '"Australia/Brisbane"', true,
   'Time zone for billing-day boundaries when an account sets none'),
  ('CANCEL_EXPORT_DAYS', '30', true,
   'Days after cancellation that a data export stays available'),
  ('CANCEL_DELETE_DAYS', '90', true,
   'Days after cancellation that the account data is deleted')
ON CONFLICT (key) DO NOTHING;

-- ── Plan codes (spec section 2) ────────────────────────────────────────
-- The old tiers (standard, enterprise, pilot, demo) stay until existing
-- subscriptions move onto these codes. INTERNAL is for QuipTech's own
-- and demo organisations: metered like every plan, never invoiced.
ALTER TABLE platform.plans
  ADD COLUMN IF NOT EXISTS unit varchar,
  ADD COLUMN IF NOT EXISTS billing_basis varchar;

INSERT INTO platform.plans (code, name, unit, billing_basis, sort_order) VALUES
  ('ASSET_PRO', 'FIELD Asset Professional', 'active machine / month', 'monthly in arrears or annual prepaid', 10),
  ('TECH', 'FIELD Technician', 'user / month', 'monthly in arrears or annual prepaid', 11),
  ('REMOTE_SESSION', 'Remote technical session', '15 minutes or part', 'monthly in arrears', 12),
  ('ENTERPRISE', 'FIELD Enterprise', 'annual contract', 'quoted annual contract', 13),
  ('ONBOARD_ASSISTED', 'Assisted onboarding', 'site, one-off', 'invoiced on completion', 14),
  ('HARDWARE', 'Hardware', 'item', 'manual invoice line', 15),
  ('INTERNAL', 'Internal / demo', 'organisation', 'not invoiced', 16)
ON CONFLICT (code) DO NOTHING;

-- ── Versioned price book ───────────────────────────────────────────────
-- One row per plan and version. unit_cents is the flat price (TECH,
-- REMOTE_SESSION block, ONBOARD_ASSISTED); ASSET_PRO prices by band
-- instead; minimum_annual_cents is the Enterprise contract floor.
CREATE TABLE IF NOT EXISTS billing.price_books (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_code             varchar NOT NULL REFERENCES platform.plans(code),
  version               integer NOT NULL CHECK (version > 0),
  effective_from        date NOT NULL,
  unit_cents            bigint CHECK (unit_cents >= 0),
  minimum_annual_cents  bigint CHECK (minimum_annual_cents >= 0),
  created_by            uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  row_version           integer NOT NULL DEFAULT 1,
  deleted_at            timestamptz,
  UNIQUE (plan_code, version)
);

-- Whole-fleet rates: the band the count falls in prices every machine.
-- upper_qty NULL = no upper bound. A count above the top band's upper_qty
-- keeps the top band's rate (spec decision: 500+ self-serve stays at the
-- 100–499 rate and raises a sales task).
CREATE TABLE IF NOT EXISTS billing.price_bands (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  price_book_id  uuid NOT NULL REFERENCES billing.price_books(id),
  band_no        integer NOT NULL CHECK (band_no > 0),
  lower_qty      integer NOT NULL CHECK (lower_qty > 0),
  upper_qty      integer CHECK (upper_qty >= lower_qty),
  unit_cents     bigint NOT NULL CHECK (unit_cents >= 0),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  row_version    integer NOT NULL DEFAULT 1,
  deleted_at     timestamptz,
  UNIQUE (price_book_id, band_no)
);

-- Version 1 of every priced plan (spec sections 2 and 11).
INSERT INTO billing.price_books (plan_code, version, effective_from, unit_cents, minimum_annual_cents)
VALUES
  ('ASSET_PRO', 1, DATE '2026-01-01', NULL, NULL),
  ('TECH', 1, DATE '2026-01-01', 4900, NULL),
  ('REMOTE_SESSION', 1, DATE '2026-01-01', 3500, NULL),
  ('ONBOARD_ASSISTED', 1, DATE '2026-01-01', 250000, NULL),
  ('ENTERPRISE', 1, DATE '2026-01-01', NULL, 500000)
ON CONFLICT (plan_code, version) DO NOTHING;

INSERT INTO billing.price_bands (price_book_id, band_no, lower_qty, upper_qty, unit_cents)
SELECT pb.id, band.band_no, band.lower_qty, band.upper_qty, band.unit_cents
FROM billing.price_books pb
CROSS JOIN (VALUES (1, 1, 25, 3500), (2, 26, 99, 2900), (3, 100, 499, 2500))
  AS band(band_no, lower_qty, upper_qty, unit_cents)
WHERE pb.plan_code = 'ASSET_PRO' AND pb.version = 1
ON CONFLICT (price_book_id, band_no) DO NOTHING;

DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['config', 'price_books', 'price_bands'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON billing.%I', 'trg_' || v_table || '_bump_row_version', v_table);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON billing.%I FOR EACH ROW EXECUTE FUNCTION bump_row_version()',
      'trg_' || v_table || '_bump_row_version', v_table);
  END LOOP;
END
$$;

-- Same level as the rest of billing: service role only.
REVOKE ALL ON billing.config, billing.price_books, billing.price_bands FROM PUBLIC, field_app;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON billing.config, billing.price_books, billing.price_bands TO field_service;

INSERT INTO schema_migrations (version)
VALUES ('0095_billing_pricing')
ON CONFLICT (version) DO NOTHING;
