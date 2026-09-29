// The single description of how commercial data is split across Postgres
// schemas and who can see it. The admin "Data & retention" page renders
// this, and test/dataIsolation.db-spec.ts checks the live database against
// it (tables, grants, RLS) — so the page can't drift from the real setup.
// Changing a schema means changing the migrations AND this file; the test
// fails until both agree.

export type SchemaVisibilityLevel =
  'all_tenants_read_only' | 'own_rows_read_only' | 'service_role_only';

export interface DataSchema {
  name: string;
  contents: string;
  level: SchemaVisibilityLevel;
  // Every table in the schema (the test checks there are no others).
  tables: string[];
}

export const VISIBILITY_LABELS: Record<SchemaVisibilityLevel, string> = {
  all_tenants_read_only: 'Read-only, all tenants',
  own_rows_read_only: 'RLS · own rows, read-only',
  service_role_only: 'None — service role only',
};

export const DATA_SCHEMAS: DataSchema[] = [
  {
    name: 'platform',
    contents: 'Plan catalogue, feature definitions',
    level: 'all_tenants_read_only',
    tables: ['features', 'plan_features', 'plans'],
  },
  {
    name: 'app',
    contents: 'Billing accounts, subscriptions, entitlements, usage',
    level: 'own_rows_read_only',
    tables: [
      'billing_accounts',
      'entitlements',
      'subscriptions',
      'usage_events',
    ],
  },
  {
    name: 'billing',
    contents: 'Stripe references, invoices, webhook log',
    level: 'service_role_only',
    tables: ['stripe_customers', 'stripe_invoices', 'stripe_webhook_log'],
  },
];

// The Postgres roles the levels are enforced against (migrations 0002, 0046).
export const TENANT_ROLE = 'field_app';
export const SERVICE_ROLE = 'field_service';

export type PrincipleIcon = 'database' | 'activity' | 'shield';

export const RETENTION_PRINCIPLES: {
  id: string;
  icon: PrincipleIcon;
  text: string;
}[] = [
  {
    id: 'config-snapshots',
    icon: 'database',
    text: 'Configuration snapshots and diffs are retained indefinitely, on every plan — the CMDB is the platform, not a free tier.',
  },
  {
    id: 'usage-metering',
    icon: 'activity',
    text: "Usage metering is written from first deployment, unconditionally, regardless of what's billed on it.",
  },
  {
    id: 'entitlement-checks',
    icon: 'shield',
    text: 'Application code never calls the billing provider directly — entitlement checks read only from QuipTech-owned tables.',
  },
  {
    id: 'audit-log',
    icon: 'shield',
    text: 'The audit log is append-only: no application role can change or delete an entry.',
  },
];

export const AI_QUERY_LOG_RETENTION_OPTIONS = [6, 12, 24] as const;
export type AiQueryLogRetentionMonths =
  (typeof AI_QUERY_LOG_RETENTION_OPTIONS)[number];
