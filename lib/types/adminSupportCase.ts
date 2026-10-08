import type { CasePerson, CasePriority, CaseStatus, SupportCase } from "./supportCase";

export type CaseStaffRole = "admin" | "assignee";
export type AdminCaseTab = "unassigned" | "mine" | "open" | "resolved";

export interface AdminSupportCase extends SupportCase {
  company: { id: string; name: string; plan: string | null };
  reporterEmail: string | null;
  // The admin may change everything; the assignee only the status.
  viewerRole: CaseStaffRole;
}

export interface AdminSupportCaseListItem {
  id: string;
  caseNumber: number;
  subject: string;
  status: CaseStatus;
  priority: CasePriority;
  company: { id: string; name: string };
  reporterName: string | null;
  assignee: CasePerson | null;
  createdAt: string;
  updatedAt: string;
  slaDueAt: string | null;
  slaPausedAt: string | null;
  isUnread: boolean;
}

export interface AdminSupportCaseList {
  items: AdminSupportCaseListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminCaseStats {
  unassigned: number;
  open: number;
  waitingOnCustomer: number;
  slaBreached: number;
  // The tab counts: open cases assigned to the viewer, and every open case.
  assignedToMe: number;
  allOpen: number;
}

export interface AdminCaseFilters {
  tab: AdminCaseTab;
  company: string;
  priority: CasePriority | "";
  status: CaseStatus | "";
  search: string;
}

export interface SupportStaffMember {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  isAdmin: boolean;
  openCaseCount: number;
}
