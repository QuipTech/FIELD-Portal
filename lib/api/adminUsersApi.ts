import { apiRequest } from "./httpClient";
import type {
  AdminOrganisation,
  AdminUserListQuery,
  AdminUserListResponse,
  InviteUserPayload,
} from "../types/adminUser";

const toQueryString = (query: AdminUserListQuery): string => {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
};

// The admin Users screen: every organisation for the Owner (platform
// administrator), or one organisation when narrowed.
export const listAdminUsersRequest = (
  accessToken: string,
  query: AdminUserListQuery,
): Promise<AdminUserListResponse> =>
  apiRequest<AdminUserListResponse>(`/admin/users${toQueryString(query)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

// Organisations to filter by and invite into (just the Owner's own).
export const listAdminOrganisationsRequest = (accessToken: string): Promise<AdminOrganisation[]> =>
  apiRequest<AdminOrganisation[]>("/admin/organisations", { headers: { Authorization: `Bearer ${accessToken}` } });

// Cognito emails them a temporary password; they set their own on first sign-in.
export const inviteUserRequest = (accessToken: string, payload: InviteUserPayload): Promise<{ id: string }> =>
  apiRequest<{ id: string }>("/admin/users/invitations", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(payload),
  });

// One role, replacing what they held. Refused for your own account and for
// the last Owner.
export const changeUserRoleRequest = (accessToken: string, userId: string, roleId: string): Promise<null> =>
  apiRequest<null>(`/admin/users/${userId}/role`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ roleId }),
  });

// Deletes their account completely and disables their sign-in; signing in
// again tells them an administrator removed them. Refused for your own
// account and for the last Owner.
export const removeUserRequest = (accessToken: string, userId: string): Promise<null> =>
  apiRequest<null>(`/admin/users/${userId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
