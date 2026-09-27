import { apiRequest } from "./httpClient";
import type { AdminPermission, AdminRole, CreateRolePayload, UpdateRolePayload } from "../types/adminRole";

// Platform-wide system roles, shared by every organisation. Owner role only.
const authorizationHeader = (accessToken: string) => ({ Authorization: `Bearer ${accessToken}` });

export const listAdminPermissionsRequest = (accessToken: string): Promise<AdminPermission[]> =>
  apiRequest<AdminPermission[]>("/admin/permissions", { headers: authorizationHeader(accessToken) });

export const listAdminRolesRequest = (accessToken: string): Promise<AdminRole[]> =>
  apiRequest<AdminRole[]>("/admin/roles", { headers: authorizationHeader(accessToken) });

export const getAdminRoleRequest = (accessToken: string, roleId: string): Promise<AdminRole> =>
  apiRequest<AdminRole>(`/admin/roles/${roleId}`, { headers: authorizationHeader(accessToken) });

export const createAdminRoleRequest = (accessToken: string, payload: CreateRolePayload): Promise<AdminRole> =>
  apiRequest<AdminRole>("/admin/roles", {
    method: "POST",
    headers: authorizationHeader(accessToken),
    body: JSON.stringify(payload),
  });

export const updateAdminRoleRequest = (
  accessToken: string,
  roleId: string,
  payload: UpdateRolePayload,
): Promise<AdminRole> =>
  apiRequest<AdminRole>(`/admin/roles/${roleId}`, {
    method: "PATCH",
    headers: authorizationHeader(accessToken),
    body: JSON.stringify(payload),
  });

// Refused (409) while the role is still assigned to users.
export const deleteAdminRoleRequest = (accessToken: string, roleId: string): Promise<void> =>
  apiRequest<void>(`/admin/roles/${roleId}`, {
    method: "DELETE",
    headers: authorizationHeader(accessToken),
  });
