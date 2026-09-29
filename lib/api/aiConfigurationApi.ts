import { apiRequest } from "./httpClient";
import type {
  AiPlatformInfo,
  AiUsageOverview,
  PromptDiff,
  PromptTestResult,
  PromptVersion,
  PromptVersionSummary,
  ReviewQueueItem,
  ReviewQueuePage,
  ReviewReviewer,
  ReviewStatus,
} from "../types/aiConfiguration";

// The admin AI configuration page: platform-wide usage, the assistant
// prompt's versions, and the review queue. Owner role only.
const authorizationHeader = (accessToken: string) => ({ Authorization: `Bearer ${accessToken}` });

const getJson = <T>(accessToken: string, path: string) =>
  apiRequest<T>(path, { headers: authorizationHeader(accessToken) });

const sendJson = <T>(accessToken: string, path: string, method: string, body?: unknown) =>
  apiRequest<T>(path, {
    method,
    headers: authorizationHeader(accessToken),
    body: body === undefined ? undefined : JSON.stringify(body),
  });

export const getAiUsageRequest = (accessToken: string, days = 30) =>
  getJson<AiUsageOverview>(accessToken, `/admin/ai/usage?days=${days}`);

export const getAiPlatformRequest = (accessToken: string) => getJson<AiPlatformInfo>(accessToken, "/admin/ai/platform");

export const listPromptVersionsRequest = (accessToken: string) =>
  getJson<PromptVersionSummary[]>(accessToken, "/admin/ai/prompts");

export const getPromptVersionRequest = (accessToken: string, versionId: string) =>
  getJson<PromptVersion>(accessToken, `/admin/ai/prompts/${versionId}`);

// Omit againstId to compare with the version saved just before.
export const getPromptDiffRequest = (accessToken: string, versionId: string, againstId?: string) =>
  getJson<PromptDiff>(accessToken, `/admin/ai/prompts/${versionId}/diff${againstId ? `?against=${againstId}` : ""}`);

export const createPromptVersionRequest = (
  accessToken: string,
  payload: { body: string; notes?: string; publish?: boolean },
) => sendJson<PromptVersion>(accessToken, "/admin/ai/prompts", "POST", payload);

export const publishPromptVersionRequest = (accessToken: string, versionId: string) =>
  sendJson<PromptVersion>(accessToken, `/admin/ai/prompts/${versionId}/publish`, "POST");

// Runs on Bedrock; nothing is saved.
export const testPromptRequest = (accessToken: string, payload: { body: string; question: string }) =>
  sendJson<PromptTestResult>(accessToken, "/admin/ai/prompts/test", "POST", payload);

export const listReviewQueueRequest = (
  accessToken: string,
  filters: { status?: ReviewStatus; reviewerId?: string },
) => {
  const query = new URLSearchParams();
  if (filters.status) query.set("status", filters.status);
  if (filters.reviewerId) query.set("reviewerId", filters.reviewerId);
  const suffix = query.toString() ? `?${query}` : "";
  return getJson<ReviewQueuePage>(accessToken, `/admin/ai/reviewQueue${suffix}`);
};

export const listReviewersRequest = (accessToken: string) =>
  getJson<ReviewReviewer[]>(accessToken, "/admin/ai/reviewQueue/reviewers");

export const updateReviewItemRequest = (
  accessToken: string,
  itemId: string,
  payload: { status?: ReviewStatus; notes?: string },
) => sendJson<ReviewQueueItem>(accessToken, `/admin/ai/reviewQueue/${itemId}`, "PATCH", payload);
