-- Section 8e: an admin edit on the Subscriptions page makes the
-- subscription manually managed. Before this, editing a subscription that
-- Stripe had cancelled kept stripe_status = 'canceled', so its
-- entitlements stayed off whatever the admin set. (Stripe webhooks switch
-- it back to 'stripe' on the next subscription event.)

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
    updated_by = EXCLUDED.updated_by,
    -- An admin edit takes the subscription over from Stripe.
    source = 'manual',
    stripe_status = NULL;

  PERFORM app.sync_entitlements(p_tenant_id);
  RETURN v_existed;
END;
$$;

INSERT INTO schema_migrations (version)
VALUES ('0050_admin_subscription_takeover')
ON CONFLICT (version) DO NOTHING;
