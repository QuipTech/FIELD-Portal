export type CaseCategory = "alarm" | "leak" | "documentation" | "ai_answer" | "wear" | "data" | "other";
export type CaseStatus = "open" | "in_progress" | "resolved";
export type CasePriority = "P1" | "P2" | "P3";
// "active" = open or in progress.
export type CaseStatusFilter = "active" | CaseStatus | "all";

export interface CasePerson {
  id: string;
  name: string;
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
}

export interface SupportCaseList {
  items: SupportCase[];
  // Across the whole organisation, ignoring the list's filters.
  statusCounts: Record<CaseStatus, number>;
}

export interface SupportCaseFilters {
  status: CaseStatusFilter;
  priority: CasePriority | "";
  // A user id, "unassigned", or "" for anyone.
  assignee: string;
  search: string;
}

export interface SupportCaseOptions {
  assignees: CasePerson[];
  machines: CaseMachine[];
}

export interface NewSupportCase {
  subject: string;
  category: CaseCategory;
  priority: CasePriority;
  machineId?: string;
  description: string;
}

export interface SupportCaseChanges {
  status?: CaseStatus;
  priority?: CasePriority;
  assigneeId?: string | null;
}
