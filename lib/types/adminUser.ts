import type { Tone } from "@/components/ui/tone";

// users.status as stored by the backend.
export type AdminUserStatus = "active" | "invited" | "disabled";

export interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  status: AdminUserStatus;
  roles: string[];
  organisation: { id: string; name: string };
  lastActiveAt: string | null;
  createdAt: string;
}

export interface AdminUserListResponse {
  users: AdminUser[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminUserListQuery {
  search?: string;
  role?: string;
  // Narrows the Owner's list to one organisation.
  organisationId?: string;
  page?: number;
  pageSize?: number;
}

export interface AdminOrganisation {
  id: string;
  name: string;
}

export interface InviteUserPayload {
  email: string;
  firstName: string;
  lastName: string;
  roleId: string;
  // Defaults to the inviter's own organisation.
  organisationId?: string;
}

export const adminUserStatusLabel: Record<AdminUserStatus, string> = {
  active: "Active",
  invited: "Invited",
  disabled: "Suspended",
};

export const adminUserStatusTone: Record<AdminUserStatus, Tone> = {
  active: "primary",
  invited: "amber",
  disabled: "danger",
};
