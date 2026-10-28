-- Section 8f: the rest of the FIELD billing spec's operations (sections 3,
-- 4, 7 and 9): every organisation on a billing plan (T22), invoice kinds
-- and due dates for overdue handling, credit notes, a chosen next term
-- (monthly ↔ annual at renewal), assisted onboarding jobs, and billing
-- notifications. Remote sessions and partners are out of scope for now;
-- their prices already live in the price book and billing.config.

-- ── Invoice kinds, due dates and overdue notices ───────────────────────
-- kind says which path raised an invoice: the monthly run (in arrears),
-- an annual term (up front), assisted onboarding, a personal TECH payment,
-- or a platform admin's manual invoice. Only monthly invoices are one per
-- account and month.
ALTER TABLE billing.invoices
  ADD COLUMN IF NOT EXISTS kind varchar NOT NULL DEFAULT 'manual'
    CHECK (kind IN ('monthly', 'annual', 'onboarding', 'personal', 'manual')),
  -- Stripe's due date; the day payment is attempted for card/direct debit.
  ADD COLUMN IF NOT EXISTS due_on date,
  ADD COLUMN IF NOT EXISTS overdue_notice_1_at timestamptz,
  ADD COLUMN IF NOT EXISTS overdue_notice_7_at timestamptz,
  ADD COLUMN IF NOT EXISTS amount_credited_cents bigint NOT NULL DEFAULT 0
    CHECK (amount_credited_cents >= 0);

UPDATE billing.invoices SET kind = 'monthly'
WHERE kind = 'manual' AND period_start IS NOT NULL AND review_until IS NOT NULL;

UPDATE billing.invoices SET kind = 'personal'
WHERE kind = 'manual' AND id IN (SELECT invoice_id FROM billing.personal_periods);

DROP INDEX IF EXISTS billing.uq_invoices_account_period;
CREATE UNIQUE INDEX IF NOT EXISTS uq_invoices_account_month
  ON billing.invoices (billing_account_id, period_start)
  WHERE kind = 'monthly' AND status <> 'void';

-- One up-front invoice per annual term.
CREATE UNIQUE INDEX IF NOT EXISTS uq_invoices_account_annual_term
  ON billing.invoices (billing_account_id, period_start)
  WHERE kind = 'annual' AND status <> 'void';

CREATE INDEX IF NOT EXISTS idx_invoices_overdue
  ON billing.invoices (due_on)
  WHERE status IN ('synced', 'payment_failed');

-- Written notice before an overdue account may be suspended (draft Terms
-- of Service: 14 days from the first overdue notice).
INSERT INTO billing.config (key, value, is_final, description) VALUES
  ('SUSPENSION_NOTICE_DAYS', '14', true,
   'Days after the first overdue notice before an administrator may suspend the account')
ON CONFLICT (key) DO NOTHING;

-- ── Credit notes ───────────────────────────────────────────────────────
-- A final invoice is never edited (spec section 8): a mistake is fixed
-- with a credit note against it, pushed to Stripe. amount_cents is what
-- the customer gets back, GST included, so it matches Stripe's credit.
CREATE TABLE IF NOT EXISTS billing.credit_notes (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id             uuid NOT NULL REFERENCES billing.invoices(id),
  billing_account_id     uuid NOT NULL REFERENCES billing.billing_accounts(id),
  amount_cents           bigint NOT NULL CHECK (amount_cents > 0),
  reason                 text NOT NULL,
  status                 varchar NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'issued')),
  stripe_credit_note_id  varchar UNIQUE,
  created_by             uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  row_version            integer NOT NULL DEFAULT 1,
  deleted_at             timestamptz
);

CREATE INDEX IF NOT EXISTS idx_credit_notes_invoice
  ON billing.credit_notes (invoice_id);

-- ── The customer's choice for their next term ──────────────────────────
-- Annual prepaid starts at sign-up or renewal (spec section 3), so a
-- monthly customer choosing annual switches on the 1st of next month, and
-- an annual customer may go back to monthly when the term ends.
ALTER TABLE billing.subscriptions
  ADD COLUMN IF NOT EXISTS next_term varchar CHECK (next_term IN ('monthly', 'annual')),
  ADD COLUMN IF NOT EXISTS next_committed_qty integer CHECK (next_committed_qty > 0);
ALTER TABLE billing.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_next_annual_qty;
ALTER TABLE billing.subscriptions ADD CONSTRAINT subscriptions_next_annual_qty
  CHECK (next_term IS DISTINCT FROM 'annual' OR next_committed_qty IS NOT NULL);

-- ── Assisted onboarding (spec section 7) ───────────────────────────────
-- A$2,500 per site (price book ONBOARD_ASSISTED), one invoice line when the
-- job is marked complete; never recurring. A waiver needs a reason and is
-- audit-logged.
CREATE TABLE IF NOT EXISTS billing.onboarding_jobs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_account_id  uuid NOT NULL REFERENCES billing.billing_accounts(id),
  site_name           varchar NOT NULL CHECK (length(trim(site_name)) > 0),
  status              varchar NOT NULL DEFAULT 'scheduled'
                        CHECK (status IN ('scheduled', 'completed', 'waived')),
  invoice_id          uuid REFERENCES billing.invoices(id),
  waived_reason       text,
  completed_at        timestamptz,
  created_by          uuid REFERENCES users(id) ON DELETE SET NULL,
  closed_by           uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  row_version         integer NOT NULL DEFAULT 1,
  deleted_at          timestamptz,
  CHECK (status <> 'waived' OR length(trim(coalesce(waived_reason, ''))) > 0)
);

CREATE INDEX IF NOT EXISTS idx_onboarding_jobs_account
  ON billing.onboarding_jobs (billing_account_id, created_at DESC);

ALTER TABLE billing.credit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing.credit_notes FORCE ROW LEVEL SECURITY;
ALTER TABLE billing.onboarding_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing.onboarding_jobs FORCE ROW LEVEL SECURITY;

-- An organisation reads its own credit notes; both are written by the
-- service role only.
DROP POLICY IF EXISTS credit_notes_own_select ON billing.credit_notes;
CREATE POLICY credit_notes_own_select ON billing.credit_notes
  FOR SELECT TO field_app USING (billing_account_id = current_billing_account_id());
DROP POLICY IF EXISTS credit_notes_service_all ON billing.credit_notes;
CREATE POLICY credit_notes_service_all ON billing.credit_notes
  FOR ALL TO field_service USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS onboarding_jobs_service_all ON billing.onboarding_jobs;
CREATE POLICY onboarding_jobs_service_all ON billing.onboarding_jobs
  FOR ALL TO field_service USING (true) WITH CHECK (true);

GRANT SELECT ON billing.credit_notes TO field_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON billing.credit_notes, billing.onboarding_jobs TO field_service;

-- ── Who pays a personal invoice (admin billing list) ───────────────────
-- users is RLS-scoped per organisation and the service role has no access
-- to it, so the platform admin's invoice list reads payers through this.
-- Only users who have a personal subscription period are returned.
CREATE OR REPLACE FUNCTION billing.personal_payers()
RETURNS TABLE (user_id uuid, email varchar, first_name varchar, last_name varchar, tenant_name varchar)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT DISTINCT u.id, u.email, u.first_name, u.last_name, t.name
  FROM billing.personal_periods p
  JOIN users u ON u.id = p.user_id
  JOIN tenants t ON t.id = p.tenant_id;
$$;

REVOKE ALL ON FUNCTION billing.personal_payers() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION billing.personal_payers() TO field_service;

-- ── Billing notifications ──────────────────────────────────────────────
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_kind_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_kind_check CHECK (kind IN (
  'case_message', 'case_assigned', 'case_status', 'case_priority',
  'machine_status', 'ai_review', 'knowledge_document', 'alert', 'billing'));

-- The people who look after an account's billing: active users of its
-- organisations who hold billing.manage (Owner, Organisation Admin).
CREATE OR REPLACE FUNCTION billing.account_admins(p_billing_account_id uuid)
RETURNS TABLE (user_id uuid, email varchar)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT u.id, u.email
  FROM tenants t
  JOIN users u ON u.tenant_id = t.id AND u.deleted_at IS NULL AND u.status = 'active'
  WHERE t.billing_account_id = p_billing_account_id AND t.deleted_at IS NULL
    AND user_has_permission(u.id, 'billing.manage');
$$;

-- QuipTech's platform administrators.
CREATE OR REPLACE FUNCTION billing.platform_admins()
RETURNS TABLE (user_id uuid, email varchar)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT u.id, u.email FROM users u
  WHERE u.deleted_at IS NULL AND u.status = 'active'
    AND user_has_permission(u.id, 'platform.manage');
$$;

-- An in-app "billing" notification for each user (bell and /notifications).
CREATE OR REPLACE FUNCTION billing.notify(
  p_user_ids uuid[], p_title text, p_body text, p_link text
)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT notify_users(p_user_ids, NULL, 'billing', p_title, p_body, p_link);
$$;

REVOKE ALL ON FUNCTION billing.account_admins(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION billing.platform_admins() FROM PUBLIC;
REVOKE ALL ON FUNCTION billing.notify(uuid[], text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION billing.account_admins(uuid) TO field_service;
GRANT EXECUTE ON FUNCTION billing.platform_admins() TO field_service;
GRANT EXECUTE ON FUNCTION billing.notify(uuid[], text, text, text) TO field_service;

-- Whether the request's organisation is suspended for non-payment: new AI
-- sessions and activations are refused, nothing in progress is stopped.
CREATE OR REPLACE FUNCTION current_billing_suspended()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM billing.billing_accounts a
    WHERE a.id = current_billing_account_id() AND a.suspended_at IS NOT NULL
  );
$$;

REVOKE ALL ON FUNCTION current_billing_suspended() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION current_billing_suspended() TO field_app;

-- ── Every organisation on a billing plan (spec T22) ────────────────────
-- New organisations sign up to monthly ASSET_PRO at registration; this
-- brings existing ones level. Monthly ASSET_PRO has no minimum, so an
-- organisation with no active machines is never charged. The billing
-- contact is the earliest user who can manage settings, else the earliest
-- user. QuipTech's own organisation (where platform admins sit) goes on
-- INTERNAL: metered like every plan, never invoiced.
DO $$
DECLARE
  v_tenant record;
  v_email varchar;
  v_account_id uuid;
BEGIN
  FOR v_tenant IN
    SELECT t.id, t.name FROM tenants t
    WHERE t.deleted_at IS NULL AND t.billing_account_id IS NULL
  LOOP
    SELECT u.email INTO v_email FROM users u
    WHERE u.tenant_id = v_tenant.id AND u.deleted_at IS NULL
    ORDER BY user_has_permission(u.id, 'billing.manage') DESC, u.created_at
    LIMIT 1;
    CONTINUE WHEN v_email IS NULL;
    INSERT INTO billing.billing_accounts (name, billing_email)
    VALUES (v_tenant.name, v_email)
    RETURNING id INTO v_account_id;
    UPDATE tenants SET billing_account_id = v_account_id WHERE id = v_tenant.id;
    PERFORM billing.record_audit_entry(v_tenant.id, NULL, 'create', 'billing_account',
      v_account_id, jsonb_build_object('billingAccountId', v_account_id,
        'reason', 'every organisation on a billing plan (migration 0109)'), 'system');
  END LOOP;
END;
$$;

INSERT INTO billing.subscriptions
  (billing_account_id, plan_code, price_book_id, term, status,
   current_period_start, current_period_end)
SELECT a.id, plan.code, book.id, 'monthly', 'active',
       date_trunc('month', (now() AT TIME ZONE a.timezone))::date,
       (date_trunc('month', (now() AT TIME ZONE a.timezone)) + interval '1 month')::date
FROM billing.billing_accounts a
CROSS JOIN LATERAL (
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM tenants t JOIN users u ON u.tenant_id = t.id AND u.deleted_at IS NULL
    WHERE t.billing_account_id = a.id AND user_has_permission(u.id, 'platform.manage')
  ) THEN 'INTERNAL' ELSE 'ASSET_PRO' END AS code
) plan
CROSS JOIN LATERAL (
  SELECT b.id FROM billing.price_books b
  WHERE b.plan_code = plan.code
    AND b.effective_from <= (now() AT TIME ZONE a.timezone)::date
    AND b.deleted_at IS NULL
  ORDER BY b.version DESC
  LIMIT 1
) book
WHERE a.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM billing.personal_accounts p WHERE p.billing_account_id = a.id)
  AND NOT EXISTS (
    SELECT 1 FROM billing.subscriptions s
    WHERE s.billing_account_id = a.id AND s.deleted_at IS NULL AND s.status <> 'cancelled'
      AND s.plan_code IN ('ASSET_PRO', 'ENTERPRISE', 'INTERNAL')
  );

INSERT INTO schema_migrations (version)
VALUES ('0109_billing_operations')
ON CONFLICT (version) DO NOTHING;
