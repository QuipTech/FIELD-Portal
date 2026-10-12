-- Section 1j: each organisation's subscription — tier, billing basis,
-- term, AI allowance and add-ons — for the admin portal's "All
-- subscriptions" page. This table is the source of truth for
-- entitlements (nothing reads Stripe directly). An organisation can read
-- its own row through RLS; the admin page reads and writes every
-- organisation's through the SECURITY DEFINER functions below, which the
-- backend's Owner-only guard restricts.

CREATE TABLE IF NOT EXISTS tenant_subscriptions (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   uuid NOT NULL UNIQUE REFERENCES tenants(id),
  tier                        varchar NOT NULL
                                CHECK (tier IN ('standard', 'enterprise', 'pilot', 'demo')),
  -- NULL only for demo tenants, which aren't billed.
  billing_basis               varchar
                                CHECK (billing_basis IN ('per_asset', 'negotiated', 'fixed_fee')),
  -- The contracted asset count on a negotiated deal.
  licensed_assets             integer CHECK (licensed_assets >= 0),
  starts_on                   date NOT NULL DEFAULT current_date,
  -- NULL = no end date (e.g. demo tenants).
  ends_on                     date,
  -- Assistant queries per calendar month; NULL = no allowance set.
  ai_monthly_query_allowance  integer CHECK (ai_monthly_query_allowance >= 0),
  wearable_seats              integer NOT NULL DEFAULT 0 CHECK (wearable_seats >= 0),
  remote_expert_seats         integer NOT NULL DEFAULT 0 CHECK (remote_expert_seats >= 0),
  sso_enabled                 boolean NOT NULL DEFAULT false,
  notes                       text,
  -- SET NULL so delete_user_account() (0025) can still hard-delete an admin.
  updated_by                  uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  row_version                 integer NOT NULL DEFAULT 1,
  CHECK (ends_on IS NULL OR ends_on >= starts_on),
  CHECK (billing_basis IS NOT NULL OR tier = 'demo'),
  CHECK (billing_basis <> 'negotiated' OR licensed_assets IS NOT NULL)
);

DROP TRIGGER IF EXISTS trg_tenant_subscriptions_bump_row_version ON tenant_subscriptions;
CREATE TRIGGER trg_tenant_subscriptions_bump_row_version
  BEFORE UPDATE ON tenant_subscriptions
  FOR EACH ROW EXECUTE FUNCTION bump_row_version();

ALTER TABLE tenant_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_subscriptions FORCE ROW LEVEL SECURITY;

-- Read-only for the organisation itself; changes go through the admin
-- functions below.
DROP POLICY IF EXISTS tenant_subscriptions_select ON tenant_subscriptions;
CREATE POLICY tenant_subscriptions_select ON tenant_subscriptions
  FOR SELECT USING (tenant_id = current_tenant_id());
REVOKE INSERT, UPDATE, DELETE ON tenant_subscriptions FROM field_app;
GRANT SELECT ON tenant_subscriptions TO field_app;

-- Every live organisation, with its subscription if it has one (the
-- subscription columns are NULL otherwise). asset_count is its live
-- machines; queries_this_month its technician messages to the assistant
-- since the start of the current UTC month. p_tenant_id NULL lists all.
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
  LEFT JOIN tenant_subscriptions s ON s.tenant_id = t.id
  WHERE t.deleted_at IS NULL
    AND (p_tenant_id IS NULL OR t.id = p_tenant_id)
  ORDER BY t.name;
$$;

-- Creates or replaces the organisation's subscription (every field is
-- set; there's no partial update). Returns whether a row existed before,
-- or NULL when there's no such live organisation.
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

  v_existed := EXISTS (SELECT 1 FROM tenant_subscriptions WHERE tenant_id = p_tenant_id);

  INSERT INTO tenant_subscriptions (
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

  RETURN v_existed;
END;
$$;

REVOKE ALL ON FUNCTION admin_list_tenant_subscriptions(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_upsert_tenant_subscription(uuid, varchar, varchar, integer, date, date, integer, integer, integer, boolean, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_list_tenant_subscriptions(uuid) TO field_app;
GRANT EXECUTE ON FUNCTION admin_upsert_tenant_subscription(uuid, varchar, varchar, integer, date, date, integer, integer, integer, boolean, text, uuid) TO field_app;

INSERT INTO schema_migrations (version)
VALUES ('0043_tenant_subscriptions')
ON CONFLICT (version) DO NOTHING;
