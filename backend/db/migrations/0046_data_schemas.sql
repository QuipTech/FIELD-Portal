-- Section 8a: schema separation for commercial data (Settings → Data &
-- retention). Three schemas, each with one visibility level — keep this
-- file in step with src/dataGovernance/dataSchemas.config.ts, which the
-- admin page renders and test/dataIsolation.db-spec.ts checks against the
-- live database:
--
--   platform  plan catalogue, feature definitions   all tenants read, service role writes
--   app       billing accounts, subscriptions,        RLS: a tenant reads its own rows;
--             entitlements, usage events             only the service role writes
--   billing   Stripe customers, invoices, webhooks   no tenant access; service role only
--
-- Roles: field_app (0002) is the tenant role — the backend's request pool,
-- scoped per request by app.tenant_id. field_service (new) is the service
-- role — used only by the billing module and background jobs.

-- ── Roles ──────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'field_service') THEN
    CREATE ROLE field_service LOGIN PASSWORD 'CHANGE_ME_SERVICE_PASSWORD';
  END IF;
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO field_service', current_database());
  -- Lets the migration user SET ROLE to either role (needed on RDS, where
  -- it isn't a true superuser) — used by the isolation tests.
  EXECUTE format('GRANT field_app, field_service TO %I', current_user);
END
$$;

GRANT USAGE ON SCHEMA public TO field_service;

-- ── Schemas ────────────────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS platform;
CREATE SCHEMA IF NOT EXISTS app;
CREATE SCHEMA IF NOT EXISTS billing;

REVOKE ALL ON SCHEMA platform, app, billing FROM PUBLIC;
GRANT USAGE ON SCHEMA platform, app TO field_app;
GRANT USAGE ON SCHEMA platform, app, billing TO field_service;

-- ── platform: the plan catalogue ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform.plans (
  code             varchar PRIMARY KEY,
  name             varchar NOT NULL,
  description      text,
  -- Stripe price that maps to this plan (the webhook syncs by it).
  stripe_price_id  varchar UNIQUE,
  sort_order       integer NOT NULL DEFAULT 0,
  is_active        boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS platform.features (
  code         varchar PRIMARY KEY,
  name         varchar NOT NULL,
  description  text,
  -- 'boolean' = on/off; 'limit' = on/off plus a numeric allowance.
  kind         varchar NOT NULL CHECK (kind IN ('boolean', 'limit')),
  unit         varchar,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS platform.plan_features (
  plan_code     varchar NOT NULL REFERENCES platform.plans(code),
  feature_code  varchar NOT NULL REFERENCES platform.features(code),
  is_enabled    boolean NOT NULL DEFAULT true,
  limit_value   integer CHECK (limit_value >= 0),
  PRIMARY KEY (plan_code, feature_code)
);

-- Starting values — edit them in the database as commercial terms settle.
INSERT INTO platform.plans (code, name, sort_order) VALUES
  ('standard', 'Standard', 1),
  ('enterprise', 'Enterprise', 2),
  ('pilot', 'Pilot', 3),
  ('demo', 'Demo', 4)
ON CONFLICT (code) DO NOTHING;

INSERT INTO platform.features (code, name, kind, unit) VALUES
  ('config_snapshots', 'Configuration snapshots & diffs (CMDB)', 'boolean', NULL),
  ('machine_history', 'Machine history', 'boolean', NULL),
  ('knowledge_library', 'Knowledge library', 'boolean', NULL),
  ('ai_assistant', 'AI assistant', 'limit', 'queries / month'),
  ('wearable_seats', 'Wearable seats', 'limit', 'seats'),
  ('remote_expert_seats', 'Remote expert seats', 'limit', 'seats'),
  ('sso', 'Single sign-on', 'boolean', NULL)
ON CONFLICT (code) DO NOTHING;

INSERT INTO platform.plan_features (plan_code, feature_code, is_enabled, limit_value)
SELECT p.plan_code, p.feature_code, p.is_enabled, p.limit_value
FROM (VALUES
  ('standard', 'config_snapshots', true, NULL), ('standard', 'machine_history', true, NULL),
  ('standard', 'knowledge_library', true, NULL), ('standard', 'ai_assistant', true, 4000),
  ('standard', 'wearable_seats', false, 0), ('standard', 'remote_expert_seats', false, 0),
  ('standard', 'sso', false, NULL),
  ('enterprise', 'config_snapshots', true, NULL), ('enterprise', 'machine_history', true, NULL),
  ('enterprise', 'knowledge_library', true, NULL), ('enterprise', 'ai_assistant', true, 20000),
  ('enterprise', 'wearable_seats', false, 0), ('enterprise', 'remote_expert_seats', false, 0),
  ('enterprise', 'sso', true, NULL),
  ('pilot', 'config_snapshots', true, NULL), ('pilot', 'machine_history', true, NULL),
  ('pilot', 'knowledge_library', true, NULL), ('pilot', 'ai_assistant', true, 1000),
  ('pilot', 'wearable_seats', false, 0), ('pilot', 'remote_expert_seats', false, 0),
  ('pilot', 'sso', false, NULL),
  ('demo', 'config_snapshots', true, NULL), ('demo', 'machine_history', true, NULL),
  ('demo', 'knowledge_library', true, NULL), ('demo', 'ai_assistant', true, 500),
  ('demo', 'wearable_seats', false, 0), ('demo', 'remote_expert_seats', false, 0),
  ('demo', 'sso', false, NULL)
) AS p(plan_code, feature_code, is_enabled, limit_value)
ON CONFLICT (plan_code, feature_code) DO NOTHING;

GRANT SELECT ON ALL TABLES IN SCHEMA platform TO field_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA platform TO field_service;

-- ── app: per-tenant commercial state ───────────────────────────────────
-- 0043 created public.tenant_subscriptions; it becomes app.subscriptions.
DO $$
BEGIN
  IF to_regclass('public.tenant_subscriptions') IS NOT NULL THEN
    ALTER TABLE public.tenant_subscriptions SET SCHEMA app;
    ALTER TABLE app.tenant_subscriptions RENAME TO subscriptions;
  END IF;
END
$$;

ALTER TABLE app.subscriptions
  ADD COLUMN IF NOT EXISTS source varchar NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'stripe')),
  -- Stripe's own status (active, past_due, canceled…) for synced rows.
  ADD COLUMN IF NOT EXISTS stripe_status varchar;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_tier_plan_fk') THEN
    ALTER TABLE app.subscriptions ADD CONSTRAINT subscriptions_tier_plan_fk
      FOREIGN KEY (tier) REFERENCES platform.plans(code);
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS app.billing_accounts (
  tenant_id      uuid PRIMARY KEY REFERENCES tenants(id),
  billing_name   varchar,
  billing_email  varchar,
  currency       varchar NOT NULL DEFAULT 'AUD',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- What a tenant may use right now. Checks read only this table (never
-- Stripe); it's rebuilt from subscription + plan by app.sync_entitlements.
CREATE TABLE IF NOT EXISTS app.entitlements (
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  feature_code  varchar NOT NULL REFERENCES platform.features(code),
  is_enabled    boolean NOT NULL,
  limit_value   integer,
  -- NULL = no expiry; otherwise usable through this date inclusive.
  valid_until   date,
  source        varchar NOT NULL CHECK (source IN ('subscription', 'stripe')),
  synced_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, feature_code)
);

-- Metering: one row per metered event, written by database triggers
-- (0047) from first deployment, whether or not the plan bills for it.
-- user_id has no FK so events outlive the user, like audit history.
CREATE TABLE IF NOT EXISTS app.usage_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id),
  event_type   varchar NOT NULL
                 CHECK (event_type IN ('ai_query', 'asset_added', 'seat_added', 'seat_removed', 'session_started')),
  user_id      uuid,
  subject_id   uuid,
  quantity     integer NOT NULL DEFAULT 1,
  metadata     jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usage_events_tenant_type_time
  ON app.usage_events (tenant_id, event_type, occurred_at DESC);

-- RLS on every app table: SELECT own rows for everyone (the tenant role);
-- a separate permissive policy gives the service role every row.
DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['billing_accounts', 'subscriptions', 'entitlements', 'usage_events'] LOOP
    EXECUTE format('ALTER TABLE app.%I ENABLE ROW LEVEL SECURITY', v_table);
    EXECUTE format('ALTER TABLE app.%I FORCE ROW LEVEL SECURITY', v_table);
    -- 0043's policy names came with the moved table.
    EXECUTE format('DROP POLICY IF EXISTS tenant_subscriptions_select ON app.%I', v_table);
    EXECUTE format('DROP POLICY IF EXISTS %I ON app.%I', v_table || '_tenant_select', v_table);
    EXECUTE format(
      'CREATE POLICY %I ON app.%I FOR SELECT USING (tenant_id = current_tenant_id())',
      v_table || '_tenant_select', v_table);
    EXECUTE format('DROP POLICY IF EXISTS %I ON app.%I', v_table || '_service_all', v_table);
    EXECUTE format(
      'CREATE POLICY %I ON app.%I FOR ALL TO field_service USING (true) WITH CHECK (true)',
      v_table || '_service_all', v_table);
  END LOOP;
END
$$;

REVOKE ALL ON ALL TABLES IN SCHEMA app FROM field_app;
GRANT SELECT ON ALL TABLES IN SCHEMA app TO field_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA app TO field_service;

-- ── billing: Stripe references, outside tenant RLS ─────────────────────
CREATE TABLE IF NOT EXISTS billing.stripe_customers (
  tenant_id           uuid PRIMARY KEY REFERENCES tenants(id),
  stripe_customer_id  varchar NOT NULL UNIQUE,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS billing.stripe_invoices (
  stripe_invoice_id   varchar PRIMARY KEY,
  tenant_id           uuid REFERENCES tenants(id),
  stripe_customer_id  varchar NOT NULL,
  status              varchar,
  currency            varchar,
  amount_due_cents    bigint,
  amount_paid_cents   bigint,
  hosted_invoice_url  varchar,
  period_start        timestamptz,
  period_end          timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Every webhook delivery, keyed by Stripe's event id so a redelivered
-- event is recognised and not applied twice.
CREATE TABLE IF NOT EXISTS billing.stripe_webhook_log (
  stripe_event_id  varchar PRIMARY KEY,
  event_type       varchar NOT NULL,
  status           varchar NOT NULL CHECK (status IN ('processed', 'ignored', 'failed')),
  error            text,
  payload          jsonb NOT NULL,
  received_at      timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON ALL TABLES IN SCHEMA billing FROM PUBLIC, field_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA billing TO field_service;

-- ── Entitlement sync ───────────────────────────────────────────────────
-- Rebuilds a tenant's entitlements from its subscription and plan, with
-- the subscription's add-ons and AI allowance layered on top. Config
-- snapshots stay on whatever happens to the subscription (the CMDB is
-- never switched off); everything else follows the subscription, and
-- valid_until carries its end date so an expired term needs no re-sync.
CREATE OR REPLACE FUNCTION app.sync_entitlements(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s app.subscriptions%ROWTYPE;
  v_has_subscription boolean;
  v_is_live boolean;
BEGIN
  SELECT * INTO s FROM app.subscriptions WHERE tenant_id = p_tenant_id;
  v_has_subscription := FOUND;
  DELETE FROM app.entitlements WHERE tenant_id = p_tenant_id;
  IF NOT v_has_subscription THEN
    RETURN;
  END IF;

  v_is_live := COALESCE(s.stripe_status, 'active') NOT IN ('canceled', 'unpaid', 'incomplete_expired');

  INSERT INTO app.entitlements (tenant_id, feature_code, is_enabled, limit_value, valid_until, source)
  SELECT p_tenant_id, f.code,
         CASE
           WHEN f.code = 'config_snapshots' THEN true
           WHEN NOT v_is_live THEN false
           WHEN f.code = 'sso' THEN COALESCE(pf.is_enabled, false) OR s.sso_enabled
           WHEN f.code = 'wearable_seats' THEN COALESCE(pf.is_enabled, false) OR s.wearable_seats > 0
           WHEN f.code = 'remote_expert_seats' THEN COALESCE(pf.is_enabled, false) OR s.remote_expert_seats > 0
           ELSE COALESCE(pf.is_enabled, false)
         END,
         CASE f.code
           WHEN 'ai_assistant' THEN COALESCE(s.ai_monthly_query_allowance, pf.limit_value)
           WHEN 'wearable_seats' THEN GREATEST(s.wearable_seats, COALESCE(pf.limit_value, 0))
           WHEN 'remote_expert_seats' THEN GREATEST(s.remote_expert_seats, COALESCE(pf.limit_value, 0))
           ELSE pf.limit_value
         END,
         CASE WHEN f.code = 'config_snapshots' THEN NULL ELSE s.ends_on END,
         CASE WHEN s.source = 'stripe' THEN 'stripe' ELSE 'subscription' END
  FROM platform.features f
  LEFT JOIN platform.plan_features pf ON pf.feature_code = f.code AND pf.plan_code = s.tier;
END;
$$;

REVOKE ALL ON FUNCTION app.sync_entitlements(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.sync_entitlements(uuid) TO field_service;

-- 0043's admin functions, now reading/writing app.subscriptions and
-- keeping entitlements in step with every change.
CREATE OR REPLACE FUNCTION admin_list_tenant_subscriptions(p_tenant_id uuid DEFAULT NULL)
RETURNS TABLE (
  tenant_id                   uuid,
  tenant_name                 varchar,
  subscription_id             uuid,
  tier                        varchar,
  billing_basis               varchar,
  licensed_assets             integer,
  starts_on                   date,
  ends_on                     date,
  ai_monthly_query_allowance  integer,
  wearable_seats              integer,
  remote_expert_seats         integer,
  sso_enabled                 boolean,
  notes                       text,
  updated_at                  timestamptz,
  asset_count                 bigint,
  queries_this_month          bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT t.id, t.name, s.id, s.tier, s.billing_basis, s.licensed_assets,
         s.starts_on, s.ends_on, s.ai_monthly_query_allowance,
         s.wearable_seats, s.remote_expert_seats, s.sso_enabled, s.notes,
         s.updated_at,
         (SELECT count(*) FROM machines m
           WHERE m.tenant_id = t.id AND m.deleted_at IS NULL),
         (SELECT count(*) FROM ai_messages am
           WHERE am.tenant_id = t.id AND am.role = 'user'
             AND am.created_at >= date_trunc('month', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')
  FROM tenants t
  LEFT JOIN app.subscriptions s ON s.tenant_id = t.id
  WHERE t.deleted_at IS NULL
    AND (p_tenant_id IS NULL OR t.id = p_tenant_id)
  ORDER BY t.name;
$$;

CREATE OR REPLACE FUNCTION admin_upsert_tenant_subscription(
  p_tenant_id                   uuid,
  p_tier                        varchar,
  p_billing_basis               varchar,
  p_licensed_assets             integer,
  p_starts_on                   date,
  p_ends_on                     date,
  p_ai_monthly_query_allowance  integer,
  p_wearable_seats              integer,
  p_remote_expert_seats         integer,
  p_sso_enabled                 boolean,
  p_notes                       text,
  p_updated_by                  uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existed boolean;
BEGIN
  PERFORM 1 FROM tenants WHERE id = p_tenant_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  v_existed := EXISTS (SELECT 1 FROM app.subscriptions WHERE tenant_id = p_tenant_id);

  INSERT INTO app.subscriptions (
    tenant_id, tier, billing_basis, licensed_assets, starts_on, ends_on,
    ai_monthly_query_allowance, wearable_seats, remote_expert_seats,
    sso_enabled, notes, updated_by
  ) VALUES (
    p_tenant_id, p_tier, p_billing_basis, p_licensed_assets, p_starts_on, p_ends_on,
    p_ai_monthly_query_allowance, p_wearable_seats, p_remote_expert_seats,
    p_sso_enabled, p_notes, p_updated_by
  )
  ON CONFLICT (tenant_id) DO UPDATE SET
    tier = EXCLUDED.tier,
    billing_basis = EXCLUDED.billing_basis,
    licensed_assets = EXCLUDED.licensed_assets,
    starts_on = EXCLUDED.starts_on,
    ends_on = EXCLUDED.ends_on,
    ai_monthly_query_allowance = EXCLUDED.ai_monthly_query_allowance,
    wearable_seats = EXCLUDED.wearable_seats,
    remote_expert_seats = EXCLUDED.remote_expert_seats,
    sso_enabled = EXCLUDED.sso_enabled,
    notes = EXCLUDED.notes,
    updated_by = EXCLUDED.updated_by;

  PERFORM app.sync_entitlements(p_tenant_id);
  RETURN v_existed;
END;
$$;

-- Existing subscriptions get their entitlements now.
SELECT app.sync_entitlements(tenant_id) FROM app.subscriptions;

INSERT INTO schema_migrations (version)
VALUES ('0046_data_schemas')
ON CONFLICT (version) DO NOTHING;

-- OPERATOR ACTION REQUIRED before deploying past local dev:
--   ALTER ROLE field_service WITH PASSWORD '<a real generated secret>';
-- then point SERVICE_DATABASE_URL at field_service.
