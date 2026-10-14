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

export const CASES_PAGE_SIZE = 25;

const toQueryString = (filters: SupportCaseFilters, page: number): string => {
  const params = new URLSearchParams({ status: filters.status, page: String(page), pageSize: String(CASES_PAGE_SIZE) });
  if (filters.priority) params.set("priority", filters.priority);
  if (filters.search.trim()) params.set("search", filters.search.trim());
  if (filters.machineId) params.set("machineId", filters.machineId);
  return params.toString();
};

export const listSupportCasesRequest = (accessToken: string, filters: SupportCaseFilters, page = 1) =>
  apiRequest<SupportCaseList>(`/cases?${toQueryString(filters, page)}`, {
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
