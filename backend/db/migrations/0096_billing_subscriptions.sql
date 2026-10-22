-- Section 8d: subscriptions and TECH seats owned by the billing account
-- (FIELD billing spec sections 1, 3 and 8), and RLS on the billing tables
-- an organisation may see: its own billing account, subscriptions, seats,
-- invoices and invoice lines, read-only. Everything else in billing stays
-- service role only. app.subscriptions (one per tenant) keeps driving
-- entitlements until the entitlement resolver replaces it; this file
-- copies its rows across.

-- ── Billing account fields ─────────────────────────────────────────────
-- partner_id gets its foreign key with the partners table. Suspension
-- blocks new sessions and activations only, never reading or export.
ALTER TABLE billing.billing_accounts
  ADD COLUMN IF NOT EXISTS partner_id uuid,
  ADD COLUMN IF NOT EXISTS billing_contact_name varchar,
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS suspension_reason text;

-- The billing account behind the request's organisation (NULL if none).
-- SECURITY DEFINER so the policies below don't depend on how tenants is
-- itself exposed to the tenant role.
CREATE OR REPLACE FUNCTION current_billing_account_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT billing_account_id FROM tenants
  WHERE id = current_tenant_id() AND deleted_at IS NULL
$$;

REVOKE ALL ON FUNCTION current_billing_account_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION current_billing_account_id() TO field_app, field_service;

-- ── Subscriptions ──────────────────────────────────────────────────────
-- price_book_id (and, for annual terms, annual_months_charged) are pinned
-- at sign-up and renewal, so a later price change never re-prices a live
-- term. Periods are billing days in the account's time zone; end is
-- exclusive.
CREATE TABLE IF NOT EXISTS billing.subscriptions (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_account_id     uuid NOT NULL REFERENCES billing.billing_accounts(id),
  plan_code              varchar NOT NULL REFERENCES platform.plans(code),
  price_book_id          uuid NOT NULL REFERENCES billing.price_books(id),
  term                   varchar NOT NULL CHECK (term IN ('monthly', 'annual')),
  committed_qty          integer CHECK (committed_qty > 0),
  annual_months_charged  integer CHECK (annual_months_charged > 0),
  contract_annual_cents  bigint CHECK (contract_annual_cents >= 0),
  status                 varchar NOT NULL DEFAULT 'active'
                           CHECK (status IN ('active', 'cancelling', 'cancelled')),
  started_at             timestamptz NOT NULL DEFAULT now(),
  current_period_start   date NOT NULL,
  current_period_end     date NOT NULL CHECK (current_period_end > current_period_start),
  cancel_at              date,
  cancelled_at           timestamptz,
  export_until           date,
  delete_after           date,
  created_by             uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  row_version            integer NOT NULL DEFAULT 1,
  deleted_at             timestamptz,
  CHECK (term = 'monthly' OR annual_months_charged IS NOT NULL)
);

-- One live subscription per plan per account (an account can hold both
-- ASSET_PRO and TECH).
CREATE UNIQUE INDEX IF NOT EXISTS uq_subscriptions_live_plan
  ON billing.subscriptions (billing_account_id, plan_code)
  WHERE status <> 'cancelled' AND deleted_at IS NULL;

-- ── TECH seats ─────────────────────────────────────────────────────────
-- A seat counts from started_on up to (not including) billing_end, the
-- first day of the month after it was removed. NULL = still held.
CREATE TABLE IF NOT EXISTS billing.seats (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_account_id  uuid NOT NULL REFERENCES billing.billing_accounts(id),
  subscription_id     uuid NOT NULL REFERENCES billing.subscriptions(id),
  user_id             uuid NOT NULL REFERENCES users(id),
  started_on          date NOT NULL,
  billing_end         date CHECK (billing_end > started_on),
  created_by          uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  row_version         integer NOT NULL DEFAULT 1,
  deleted_at          timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_seats_held_user
  ON billing.seats (subscription_id, user_id)
  WHERE billing_end IS NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_seats_account ON billing.seats (billing_account_id);

-- INTERNAL (QuipTech and demo organisations) is never invoiced, but every
-- subscription pins a price book, so it gets a zero-priced one.
INSERT INTO billing.price_books (plan_code, version, effective_from, unit_cents)
VALUES ('INTERNAL', 1, DATE '2026-01-01', 0)
ON CONFLICT (plan_code, version) DO NOTHING;

DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['subscriptions', 'seats'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON billing.%I', 'trg_' || v_table || '_bump_row_version', v_table);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON billing.%I FOR EACH ROW EXECUTE FUNCTION bump_row_version()',
      'trg_' || v_table || '_bump_row_version', v_table);
  END LOOP;
END
$$;

-- ── RLS: own billing account, read-only ────────────────────────────────
-- Same shape as 0046's app tables: SELECT own rows for the tenant role, a
-- separate permissive policy for the service role.
DO $$
DECLARE
  v_table text;
  v_own_rows text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['billing_accounts', 'subscriptions', 'seats', 'invoices', 'invoice_lines'] LOOP
    v_own_rows := CASE v_table
      WHEN 'billing_accounts' THEN 'id = current_billing_account_id()'
      WHEN 'invoice_lines' THEN
        'invoice_id IN (SELECT id FROM billing.invoices WHERE billing_account_id = current_billing_account_id())'
      ELSE 'billing_account_id = current_billing_account_id()'
    END;
    EXECUTE format('ALTER TABLE billing.%I ENABLE ROW LEVEL SECURITY', v_table);
    EXECUTE format('ALTER TABLE billing.%I FORCE ROW LEVEL SECURITY', v_table);
    EXECUTE format('DROP POLICY IF EXISTS %I ON billing.%I', v_table || '_own_select', v_table);
    EXECUTE format('CREATE POLICY %I ON billing.%I FOR SELECT TO field_app USING (%s)',
      v_table || '_own_select', v_table, v_own_rows);
    EXECUTE format('DROP POLICY IF EXISTS %I ON billing.%I', v_table || '_service_all', v_table);
    EXECUTE format('CREATE POLICY %I ON billing.%I FOR ALL TO field_service USING (true) WITH CHECK (true)',
      v_table || '_service_all', v_table);
  END LOOP;
END
$$;

GRANT USAGE ON SCHEMA billing TO field_app;
REVOKE ALL ON billing.subscriptions, billing.seats FROM PUBLIC, field_app;
GRANT SELECT ON billing.billing_accounts, billing.subscriptions, billing.seats,
  billing.invoices, billing.invoice_lines TO field_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON billing.subscriptions, billing.seats TO field_service;

-- ── Audit from the service role ────────────────────────────────────────
-- Billing changes run on the service role, which has no INSERT on
-- audit_logs (0048 keeps the log append-only). This writes one entry in
-- the caller's transaction; user_id is NULL for scheduled jobs.
CREATE OR REPLACE FUNCTION billing.record_audit_entry(
  p_tenant_id    uuid,
  p_user_id      uuid,
  p_action       varchar,
  p_entity_type  varchar,
  p_entity_id    uuid,
  p_metadata     jsonb,
  p_source       varchar
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, metadata, source)
  VALUES (p_tenant_id, p_user_id, p_action, p_entity_type, p_entity_id, p_metadata, p_source)
$$;

REVOKE ALL ON FUNCTION billing.record_audit_entry(uuid, uuid, varchar, varchar, uuid, jsonb, varchar) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION billing.record_audit_entry(uuid, uuid, varchar, varchar, uuid, jsonb, varchar) TO field_service;

-- One account, many organisations: a super admin attaches organisations
-- to an account. Only that column, nothing else on tenants.
GRANT UPDATE (billing_account_id) ON tenants TO field_service;

-- A TECH seat must name a user of one of the account's organisations.
-- users is RLS-scoped per tenant, so the check is a SECURITY DEFINER
-- yes/no that exposes nothing else about the user.
CREATE OR REPLACE FUNCTION billing.user_belongs_to_account(
  p_user_id             uuid,
  p_billing_account_id  uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users u
    JOIN tenants t ON t.id = u.tenant_id AND t.deleted_at IS NULL
    WHERE u.id = p_user_id AND u.deleted_at IS NULL
      AND t.billing_account_id = p_billing_account_id
  )
$$;

REVOKE ALL ON FUNCTION billing.user_belongs_to_account(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION billing.user_belongs_to_account(uuid, uuid) TO field_service;

-- Sign-up reuses 0094's audited account create from the service role too.
GRANT EXECUTE ON FUNCTION admin_create_billing_account(uuid, varchar, varchar, varchar, varchar) TO field_service;

-- ── Copy existing tenant subscriptions onto their billing account ──────
-- Only organisations that already have a billing account; the rest move
-- when one is created. standard → ASSET_PRO, enterprise → ENTERPRISE,
-- pilot/demo → INTERNAL (no pilot product). Monthly, pinned to the
-- version 1 price book, period = the current calendar month in the
-- account's time zone. Where several organisations share an account the
-- highest tier wins.
INSERT INTO billing.subscriptions
  (billing_account_id, plan_code, price_book_id, term, current_period_start, current_period_end)
SELECT DISTINCT ON (t.billing_account_id)
       t.billing_account_id, mapped.plan_code, pb.id, 'monthly',
       date_trunc('month', (now() AT TIME ZONE a.timezone))::date,
       (date_trunc('month', (now() AT TIME ZONE a.timezone)) + interval '1 month')::date
FROM app.subscriptions s
JOIN tenants t ON t.id = s.tenant_id AND t.billing_account_id IS NOT NULL
JOIN billing.billing_accounts a ON a.id = t.billing_account_id
CROSS JOIN LATERAL (
  SELECT
    CASE s.tier
      WHEN 'standard' THEN 'ASSET_PRO'
      WHEN 'enterprise' THEN 'ENTERPRISE'
      ELSE 'INTERNAL'
    END AS plan_code,
    CASE s.tier WHEN 'enterprise' THEN 1 WHEN 'standard' THEN 2 ELSE 3 END AS tier_rank
) mapped
JOIN billing.price_books pb ON pb.plan_code = mapped.plan_code AND pb.version = 1
WHERE NOT EXISTS (
  SELECT 1 FROM billing.subscriptions existing
  WHERE existing.billing_account_id = t.billing_account_id
    AND existing.status <> 'cancelled' AND existing.deleted_at IS NULL
)
ORDER BY t.billing_account_id, mapped.tier_rank;

INSERT INTO schema_migrations (version)
VALUES ('0096_billing_subscriptions')
ON CONFLICT (version) DO NOTHING;
