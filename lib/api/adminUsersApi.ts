import { apiRequest } from "./httpClient";
import type { AdminUserListQuery, AdminUserListResponse } from "../types/adminUser";

const toQueryString = (query: AdminUserListQuery): string => {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
};

// Platform-wide user directory (every organisation). Owner role only.
export const listAdminUsersRequest = (
  accessToken: string,
  query: AdminUserListQuery,
): Promise<AdminUserListResponse> =>
  apiRequest<AdminUserListResponse>(`/admin/users${toQueryString(query)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
