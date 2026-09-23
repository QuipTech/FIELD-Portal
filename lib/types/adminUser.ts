import type { Tone } from "@/components/ui/tone";

export type AdminUserStatus = "Active" | "Invited" | "Suspended";

export interface AdminUser {
  id: string;
  initials: string;
  name: string;
  email: string;
  role: string;
  site: string;
  lastActiveLabel: string;
  status: AdminUserStatus;
}

export const adminUserStatusTone: Record<AdminUserStatus, Tone> = {
  Active: "primary",
  Invited: "amber",
  Suspended: "danger",
};
