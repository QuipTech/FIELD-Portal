import { apiRequest } from "./httpClient";
import type { SupportCaseChanges } from "../types/supportCase";
import type {
  AdminCaseFilters,
  AdminCaseStats,
  AdminSupportCase,
  AdminSupportCaseList,
  SupportStaffMember,
} from "../types/adminSupportCase";

// The support queue for QuipTech staff (A13–A13c). The admin sees every
// organisation's cases; a Support Agent only theirs. The thread itself is
// caseThreadApi with scope "staff".

const authorizationHeader = (accessToken: string) => ({ Authorization: `Bearer ${accessToken}` });

const toQueryString = (filters: AdminCaseFilters, page: number, pageSize: number): string => {
  const params = new URLSearchParams({ tab: filters.tab, page: String(page), pageSize: String(pageSize) });
  if (filters.company) params.set("company", filters.company);
  if (filters.priority) params.set("priority", filters.priority);
  if (filters.status) params.set("status", filters.status);
  if (filters.search.trim()) params.set("search", filters.search.trim());
  return params.toString();
};

export const listAdminCasesRequest = (accessToken: string, filters: AdminCaseFilters, page: number, pageSize: number) =>
  apiRequest<AdminSupportCaseList>(`/admin/cases?${toQueryString(filters, page, pageSize)}`, {
    headers: authorizationHeader(accessToken),
  });

export const getAdminCaseStatsRequest = (accessToken: string) =>
  apiRequest<AdminCaseStats>("/admin/cases/stats", { headers: authorizationHeader(accessToken) });

export const getAdminCaseRequest = (accessToken: string, caseNumber: number) =>
  apiRequest<AdminSupportCase>(`/admin/cases/${caseNumber}`, { headers: authorizationHeader(accessToken) });

// The admin may change any field; the assignee only the status (403 otherwise).
export const updateAdminCaseRequest = (accessToken: string, caseNumber: number, changes: SupportCaseChanges) =>
  apiRequest<AdminSupportCase>(`/admin/cases/${caseNumber}`, {
    method: "PATCH",
    headers: authorizationHeader(accessToken),
    body: JSON.stringify(changes),
  });

// Admin only: everyone who can take cases, with their open case counts.
export const listSupportStaffRequest = (accessToken: string) =>
  apiRequest<SupportStaffMember[]>("/admin/staff", { headers: authorizationHeader(accessToken) });
