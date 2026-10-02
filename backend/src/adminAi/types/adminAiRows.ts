import { AiPlatformUsageSource } from '../../aiPlatformUsage/types/aiPlatformUsageEntry';

// Rows of the SECURITY DEFINER functions in migration 0041. bigint and
// numeric values arrive from pg as strings.

export interface UsageSummaryRow {
  total_queries: string;
  prior_queries: string;
  active_users: string;
  total_users: string;
  total_cost: number;
  flagged_in_period: string;
  unreviewed_count: string;
}

// admin_ai_platform_usage (migration 0063): one row per source.
export interface PlatformUsageRow {
  source: AiPlatformUsageSource;
  call_count: string;
  input_tokens: string;
  output_tokens: string;
  total_cost: number;
}

export interface QueriesPerDayRow {
  day: Date;
  query_count: string;
}

export interface UsageByOrganisationRow {
  tenant_id: string;
  organisation_name: string;
  query_count: string;
}

export interface PromptVersionRow {
  id: string;
  version_number: number;
  body: string;
  notes: string | null;
  is_live: boolean;
  created_at: Date;
  published_at: Date | null;
  created_by_name: string | null;
  published_by_name: string | null;
}

export interface ReviewItemRow {
  id: string;
  tenant_id: string;
  organisation_name: string;
  question: string | null;
  answer: string;
  reason_code: string | null;
  reason: string | null;
  notes: string | null;
  status: string;
  reviewer_id: string | null;
  reviewer_name: string | null;
  reviewer_avatar: string | null;
  flagged_at: Date;
  reviewed_at: Date | null;
  total_count: string;
}

export interface ReviewStatusCountRow {
  status: string;
  item_count: string;
}

export interface ReviewerRow {
  id: string;
  name: string;
  avatar_url: string | null;
}
