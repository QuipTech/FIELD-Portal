import type { CasePerson } from "./supportCase";

export type CaseAuthorRole = "customer" | "assignee" | "admin" | "system";

export interface CaseAttachment {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  // Short-lived signed URL; null when the API has no file storage.
  url: string | null;
}

export interface CaseMessage {
  id: string;
  body: string;
  createdAt: string;
  // null once the author's account is deleted.
  author: CasePerson | null;
  authorRole: CaseAuthorRole;
  // A staff-only note; the API never sends these to customers.
  isInternal: boolean;
  attachments: CaseAttachment[];
}

export type CaseEventType = "created" | "assigned" | "unassigned" | "status_changed" | "priority_changed" | "reopened";

// A system line in the thread, e.g. "A. Kaur assigned the case to T. Meyer".
export interface CaseEvent {
  id: string;
  type: CaseEventType;
  actor: CasePerson | null;
  fromValue: string | null;
  toValue: string | null;
  // assigned / unassigned: the people fromValue and toValue name.
  fromPerson: CasePerson | null;
  toPerson: CasePerson | null;
  createdAt: string;
}

// Reply to the customer, or a note only staff can read.
export interface NewCaseMessage {
  body: string;
  isInternal?: boolean;
  attachmentIds?: string[];
}
