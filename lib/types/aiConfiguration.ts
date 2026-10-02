export interface AiUsageOverview {
  periodDays: number;
  totalQueries: number;
  priorPeriodQueries: number;
  // null when the prior period had no queries to compare against.
  changePercent: number | null;
  activeUsers: number;
  totalUsers: number;
  // Assistant answers plus otherUsage.
  totalCost: number;
  assistantCost: number;
  avgCostPerQuery: number;
  averageQueriesPerDay: number;
  flaggedInPeriod: number;
  unreviewedCount: number;
  queriesPerDay: { date: string; count: number }[];
  usageByOrganisation: { organisationId: string; name: string; queries: number; sharePercent: number }[];
  // Bedrock calls that aren't answers.
  otherUsage: { source: AiUsageSource; calls: number; tokens: number; cost: number }[];
}

export type AiUsageSource = "prompt_test" | "indexing" | "search";

export interface AiPlatformInfo {
  provider: string;
  region: string;
  isLocked: true;
  models: { role: "answers" | "background"; label: string; modelId: string; purpose: string }[];
}

export interface PromptVersionSummary {
  id: string;
  versionNumber: number;
  isLive: boolean;
  notes: string | null;
  createdAt: string;
  createdByName: string | null;
  publishedAt: string | null;
  publishedByName: string | null;
}

export interface PromptVersion extends PromptVersionSummary {
  body: string;
}

export interface PromptDiff {
  from: PromptVersionSummary;
  to: PromptVersionSummary;
  lines: { type: "same" | "added" | "removed"; text: string }[];
}

export interface PromptTestResult {
  answer: string;
  modelId: string;
  stopReason: string | null;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

export type ReviewStatus = "unreviewed" | "in_review" | "resolved" | "escalated";
export type ReviewReasonCode = "no_source" | "low_confidence" | "marked_wrong" | "safety_refusal";

export interface ReviewReviewer {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface ReviewQueueItem {
  id: string;
  organisationName: string;
  question: string | null;
  answer: string;
  reasonCode: ReviewReasonCode | null;
  reason: string | null;
  notes: string | null;
  status: ReviewStatus;
  reviewer: ReviewReviewer | null;
  flaggedAt: string;
  reviewedAt: string | null;
}

export interface ReviewQueuePage {
  items: ReviewQueueItem[];
  total: number;
  page: number;
  pageSize: number;
  statusCounts: Partial<Record<ReviewStatus, number>>;
}
