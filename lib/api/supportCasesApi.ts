import { apiRequest } from "./httpClient";
import type { CaseMessage } from "../types/caseMessage";
import type {
  NewSupportCase,
  SupportCase,
  SupportCaseChanges,
  SupportCaseFilters,
  SupportCaseList,
  SupportCaseOptions,
} from "../types/supportCase";

const authorizationHeader = (accessToken: string) => ({ Authorization: `Bearer ${accessToken}` });

const toQueryString = (filters: SupportCaseFilters): string => {
  const params = new URLSearchParams({ status: filters.status });
  if (filters.priority) params.set("priority", filters.priority);
  if (filters.assignee) params.set("assignee", filters.assignee);
  if (filters.search.trim()) params.set("search", filters.search.trim());
  return params.toString();
};

export const listSupportCasesRequest = (accessToken: string, filters: SupportCaseFilters) =>
  apiRequest<SupportCaseList>(`/support-cases?${toQueryString(filters)}`, {
    headers: authorizationHeader(accessToken),
  });

// Assignees and machines for the filters and the New case form.
export const getSupportCaseOptionsRequest = (accessToken: string) =>
  apiRequest<SupportCaseOptions>("/support-cases/options", { headers: authorizationHeader(accessToken) });

// The description becomes the case's first message.
export const createSupportCaseRequest = (accessToken: string, newCase: NewSupportCase) =>
  apiRequest<SupportCase>("/support-cases", {
    method: "POST",
    headers: authorizationHeader(accessToken),
    body: JSON.stringify(newCase),
  });

export const getSupportCaseRequest = (accessToken: string, caseNumber: number) =>
  apiRequest<SupportCase>(`/support-cases/${caseNumber}`, { headers: authorizationHeader(accessToken) });

// Needs support.manage. Only the fields sent change.
export const updateSupportCaseRequest = (accessToken: string, caseNumber: number, changes: SupportCaseChanges) =>
  apiRequest<SupportCase>(`/support-cases/${caseNumber}`, {
    method: "PATCH",
    headers: authorizationHeader(accessToken),
    body: JSON.stringify(changes),
  });

export const listCaseMessagesRequest = (accessToken: string, caseNumber: number) =>
  apiRequest<CaseMessage[]>(`/support-cases/${caseNumber}/messages`, { headers: authorizationHeader(accessToken) });

// 409 once the case is resolved. Everyone with the case open gets it live.
export const postCaseMessageRequest = (accessToken: string, caseNumber: number, body: string) =>
  apiRequest<CaseMessage>(`/support-cases/${caseNumber}/messages`, {
    method: "POST",
    headers: authorizationHeader(accessToken),
    body: JSON.stringify({ body }),
  });
