import { apiRequest } from "./httpClient";
import type {
  NewSupportCase,
  SupportCase,
  SupportCaseFilters,
  SupportCaseList,
  SupportCaseOptions,
} from "../types/supportCase";

// The customer side: cases in the signed-in user's own organisation. The
// thread itself (messages, events, attachments) is caseThreadApi.

const authorizationHeader = (accessToken: string) => ({ Authorization: `Bearer ${accessToken}` });

const toQueryString = (filters: SupportCaseFilters): string => {
  const params = new URLSearchParams({ status: filters.status });
  if (filters.priority) params.set("priority", filters.priority);
  if (filters.search.trim()) params.set("search", filters.search.trim());
  return params.toString();
};

export const listSupportCasesRequest = (accessToken: string, filters: SupportCaseFilters) =>
  apiRequest<SupportCaseList>(`/cases?${toQueryString(filters)}`, {
    headers: authorizationHeader(accessToken),
  });

// Machines for the New case form.
export const getSupportCaseOptionsRequest = (accessToken: string) =>
  apiRequest<SupportCaseOptions>("/cases/options", { headers: authorizationHeader(accessToken) });

// The description becomes the case's first message, carrying the attachments.
export const createSupportCaseRequest = (accessToken: string, newCase: NewSupportCase) =>
  apiRequest<SupportCase>("/cases", {
    method: "POST",
    headers: authorizationHeader(accessToken),
    body: JSON.stringify(newCase),
  });

export const getSupportCaseRequest = (accessToken: string, caseNumber: number) =>
  apiRequest<SupportCase>(`/cases/${caseNumber}`, { headers: authorizationHeader(accessToken) });

// 409 unless the case was resolved in the last 7 days.
export const reopenSupportCaseRequest = (accessToken: string, caseNumber: number) =>
  apiRequest<SupportCase>(`/cases/${caseNumber}/reopen`, {
    method: "POST",
    headers: authorizationHeader(accessToken),
  });
