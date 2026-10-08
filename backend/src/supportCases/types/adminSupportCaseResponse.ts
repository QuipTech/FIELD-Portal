import {
  CasePerson,
  CasePriority,
  CaseStatus,
  SupportCase,
} from './supportCaseResponse';

// Who a staff member is on a case: the admin (platform.manage) works
// every case; an assignee only their own.
export type CaseStaffRole = 'admin' | 'assignee';

export interface CaseCompany {
  id: string;
  name: string;
  // The organisation's subscription tier, e.g. "standard"; null when none.
  plan: string | null;
}

export interface AdminSupportCase extends SupportCase {
  company: CaseCompany;
  reporterEmail: string | null;
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
  // A message the viewer hasn't read yet.
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

export interface SupportStaffMember {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  isAdmin: boolean;
  openCaseCount: number;
}
