export type CaseCategory = "alarm" | "leak" | "documentation" | "ai_answer" | "wear" | "data" | "other";
export type CaseStatus = "new" | "open" | "waiting_on_customer" | "resolved" | "closed";
export type CasePriority = "P1" | "P2" | "P3";
// "active" = new, open or waiting on the customer.
export type CaseStatusFilter = "active" | CaseStatus | "all";

export interface CasePerson {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface CaseMachine {
  id: string;
  // Asset number, or the serial number when there is none.
  label: string;
  modelName: string | null;
}

export interface SupportCase {
  id: string;
  caseNumber: number;
  subject: string;
  description: string | null;
  category: CaseCategory;
  status: CaseStatus;
  priority: CasePriority;
  machine: CaseMachine | null;
  assignee: CasePerson | null;
  // null once the reporter's account is deleted.
  reporter: CasePerson | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  closedAt: string | null;
  slaDueAt: string | null;
  // Set while waiting on the customer: the SLA clock stopped then.
  slaPausedAt: string | null;
}

export interface SupportCaseList {
  items: SupportCase[];
  // Across the whole organisation, ignoring the list's filters.
  statusCounts: Record<CaseStatus, number>;
}

export interface SupportCaseFilters {
  status: CaseStatusFilter;
  priority: CasePriority | "";
  search: string;
}

export interface SupportCaseOptions {
  machines: CaseMachine[];
}

export interface NewSupportCase {
  subject: string;
  category: CaseCategory;
  priority: CasePriority;
  machineId?: string;
  description: string;
  attachmentIds?: string[];
}

// Staff only (PATCH /admin/cases/:n). Only the fields sent change.
export interface SupportCaseChanges {
  status?: CaseStatus;
  priority?: CasePriority;
  assigneeId?: string | null;
}
