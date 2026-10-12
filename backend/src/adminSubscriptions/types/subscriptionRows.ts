// One row of admin_list_tenant_subscriptions() (migration 0043). The
// subscription columns are null for an organisation without one. bigint
// arrives from pg as a string, date as a local-midnight Date.
export interface TenantSubscriptionRow {
  tenant_id: string;
  tenant_name: string;
  subscription_id: string | null;
  tier: string | null;
  billing_basis: string | null;
  licensed_assets: number | null;
  starts_on: Date | null;
  ends_on: Date | null;
  ai_monthly_query_allowance: number | null;
  wearable_seats: number | null;
  remote_expert_seats: number | null;
  sso_enabled: boolean | null;
  notes: string | null;
  updated_at: Date | null;
  asset_count: string;
  queries_this_month: string;
}
