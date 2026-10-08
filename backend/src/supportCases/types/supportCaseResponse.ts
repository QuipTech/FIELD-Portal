export const CASE_CATEGORIES = [
  'alarm',
  'leak',
  'documentation',
  'ai_answer',
  'wear',
  'data',
  'other',
] as const;
export const CASE_STATUSES = [
  'new',
  'open',
  'waiting_on_customer',
  'resolved',
  'closed',
] as const;
export const CASE_PRIORITIES = ['P1', 'P2', 'P3'] as const;
export const CASE_AUTHOR_ROLES = [
  'customer',
  'assignee',
  'admin',
  'system',
] as const;
export const CASE_EVENT_TYPES = [
  'created',
  'assigned',
  'unassigned',
  'status_changed',
  'priority_changed',
  'reopened',
] as const;

export type CaseCategory = (typeof CASE_CATEGORIES)[number];
export type CaseStatus = (typeof CASE_STATUSES)[number];
export type CasePriority = (typeof CASE_PRIORITIES)[number];
export type CaseAuthorRole = (typeof CASE_AUTHOR_ROLES)[number];
export type CaseEventType = (typeof CASE_EVENT_TYPES)[number];

export interface CasePerson {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface CaseMachine {
  id: string;
  // The asset number, or the serial number when there is none.
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

export interface CaseAttachment {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  // Short-lived signed URL; null when storage isn't configured.
  url: string | null;
}

export interface CaseMessage {
  id: string;
  body: string;
  createdAt: string;
  // null once the author's account is deleted.
  author: CasePerson | null;
  authorRole: CaseAuthorRole;
  // Staff-only notes; never sent to a customer.
  isInternal: boolean;
  attachments: CaseAttachment[];
}

// A system line in the thread, e.g. "A. Kaur assigned the case to T. Meyer".
export interface CaseEvent {
  id: string;
  type: CaseEventType;
  actor: CasePerson | null;
  fromValue: string | null;
  toValue: string | null;
  // assigned / unassigned: the people from_value and to_value name.
  fromPerson: CasePerson | null;
  toPerson: CasePerson | null;
  createdAt: string;
}

export interface SupportCaseOptions {
  machines: CaseMachine[];
}
