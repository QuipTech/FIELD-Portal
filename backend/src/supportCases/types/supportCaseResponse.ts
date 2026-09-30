export const CASE_CATEGORIES = [
  'alarm',
  'leak',
  'documentation',
  'ai_answer',
  'wear',
  'data',
  'other',
] as const;
export const CASE_STATUSES = ['open', 'in_progress', 'resolved'] as const;
export const CASE_PRIORITIES = ['P1', 'P2', 'P3'] as const;

export type CaseCategory = (typeof CASE_CATEGORIES)[number];
export type CaseStatus = (typeof CASE_STATUSES)[number];
export type CasePriority = (typeof CASE_PRIORITIES)[number];

export interface CasePerson {
  id: string;
  name: string;
}

export interface SupportCase {
  id: string;
  caseNumber: number;
  subject: string;
  category: CaseCategory;
  status: CaseStatus;
  priority: CasePriority;
  // label is the asset number, or the serial number when there is none.
  machine: { id: string; label: string; modelName: string | null } | null;
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

export interface CaseMessage {
  id: string;
  body: string;
  createdAt: string;
  author: CasePerson | null;
  // The reporter's messages are "reporter"; everyone else answers as support.
  authorRole: 'reporter' | 'support';
}

export interface SupportCaseOptions {
  // Users who hold support.manage and can take a case.
  assignees: CasePerson[];
  machines: { id: string; label: string; modelName: string | null }[];
}
