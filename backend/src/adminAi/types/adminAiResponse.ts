export interface AiUsageOverview {
  periodDays: number;
  totalQueries: number;
  priorPeriodQueries: number;
  // null when the prior period had no queries to compare against.
  changePercent: number | null;
  activeUsers: number;
  totalUsers: number;
  totalCost: number;
  avgCostPerQuery: number;
  averageQueriesPerDay: number;
  flaggedInPeriod: number;
  unreviewedCount: number;
  queriesPerDay: { date: string; count: number }[];
  usageByOrganisation: {
    organisationId: string;
    name: string;
    queries: number;
    sharePercent: number;
  }[];
}

export interface AiPlatformModel {
  role: 'answers' | 'background';
  label: string;
  modelId: string;
  purpose: string;
}

// Read-only: the platform manages provider, region and models for every
// tenant, so nothing here can be changed through the API.
export interface AiPlatformInfo {
  provider: string;
  region: string;
  isLocked: true;
  models: AiPlatformModel[];
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

export type PromptDiffLineType = 'same' | 'added' | 'removed';

export interface PromptDiff {
  from: PromptVersionSummary;
  to: PromptVersionSummary;
  lines: { type: PromptDiffLineType; text: string }[];
}

export interface PromptTestResult {
  answer: string;
  modelId: string;
  stopReason: string | null;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

export interface ReviewQueueItem {
  id: string;
  organisationName: string;
  question: string | null;
  answer: string;
  reasonCode: string | null;
  reason: string | null;
  notes: string | null;
  status: string;
  reviewer: { id: string; name: string; avatarUrl: string | null } | null;
  flaggedAt: string;
  reviewedAt: string | null;
}

export interface ReviewQueuePage {
  items: ReviewQueueItem[];
  total: number;
  page: number;
  pageSize: number;
  statusCounts: Record<string, number>;
}
