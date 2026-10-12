import { apiDownloadRequest, apiRequest } from "./httpClient";
import type { AuditLogFilterOptions, AuditLogFilters, AuditLogPage } from "../types/auditLog";

// Every organisation's audit events. Owner role only.
const authorizationHeader = (accessToken: string) => ({ Authorization: `Bearer ${accessToken}` });

const toFilterQuery = (filters: AuditLogFilters): URLSearchParams => {
  const query = new URLSearchParams();
  if (filters.actorId) query.set("actorId", filters.actorId);
  if (filters.eventType) {
    const [entityType, action] = filters.eventType.split(":");
    query.set("entityType", entityType);
    query.set("action", action);
  }
  if (filters.from) query.set("from", filters.from);
  return query;
};

export const listAuditLogRequest = (accessToken: string, filters: AuditLogFilters, page: number, pageSize: number) => {
  const query = toFilterQuery(filters);
  query.set("page", String(page));
  query.set("pageSize", String(pageSize));
  return apiRequest<AuditLogPage>(`/admin/auditLog?${query}`, { headers: authorizationHeader(accessToken) });
};

export const listAuditLogFiltersRequest = (accessToken: string) =>
  apiRequest<AuditLogFilterOptions>("/admin/auditLog/filters", { headers: authorizationHeader(accessToken) });

// isTruncated: more events matched than one export holds.
export const exportAuditLogRequest = async (accessToken: string, filters: AuditLogFilters) => {
  const { blob, headers } = await apiDownloadRequest(`/admin/auditLog/export?${toFilterQuery(filters)}`, {
    headers: authorizationHeader(accessToken),
  });
  return { blob, isTruncated: headers.get("X-Export-Truncated") === "true" };
};
