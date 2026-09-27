import type { IconName } from "@/components/icons/icon";
import type { Tone } from "@/components/ui/tone";

export interface SchemaVisibilityRow {
  schema: string;
  contents: string;
  visibilityLabel: string;
  visibilityTone: Tone;
}

export const schemaVisibilityRows: SchemaVisibilityRow[] = [
  {
    schema: "platform",
    contents: "Plan catalogue, feature definitions",
    visibilityLabel: "Read-only, all tenants",
    visibilityTone: "ok",
  },
  {
    schema: "app",
    contents: "Billing accounts, subscriptions, entitlements, usage",
    visibilityLabel: "RLS · own rows, read-only",
    visibilityTone: "amber",
  },
  {
    schema: "billing",
    contents: "Stripe references, invoices, webhook log",
    visibilityLabel: "None — service role only",
    visibilityTone: "danger",
  },
];

export interface RetentionPrinciple {
  id: string;
  text: string;
  icon: IconName;
}

export const retentionPrinciples: RetentionPrinciple[] = [
  {
    id: "config-snapshots",
    icon: "db",
    text: "Configuration snapshots and diffs are retained indefinitely — the CMDB is the platform, not a free tier.",
  },
  {
    id: "usage-metering",
    icon: "activity",
    text: "Usage metering is written from first deployment, unconditionally, regardless of what's billed on it.",
  },
  {
    id: "entitlement-checks",
    icon: "shield",
    text: "Application code never calls the billing provider directly — entitlement checks read only from QuipTech-owned tables.",
  },
];
