import {
  CASE_STATUSES,
  CaseAttachment,
  CaseAuthorRole,
  CaseCategory,
  CaseEvent,
  CaseEventType,
  CaseMessage,
  CasePerson,
  CasePriority,
  CaseStatus,
  SupportCase,
} from './types/supportCaseResponse';
import {
  CaseEventRow,
  CaseMessageRow,
  StatusCountRow,
  SupportCaseRow,
} from './types/supportCaseRows';

export const toPersonName = (
  firstName: string | null,
  lastName: string | null,
): string => `${firstName ?? ''} ${lastName ?? ''}`.trim();

export const toPerson = (
  id: string | null,
  firstName: string | null,
  lastName: string | null,
  avatarUrl: string | null = null,
): CasePerson | null =>
  id ? { id, name: toPersonName(firstName, lastName), avatarUrl } : null;

const toIso = (value: Date | null): string | null =>
  value?.toISOString() ?? null;

export const toSupportCase = (row: SupportCaseRow): SupportCase => ({
  id: row.id,
  caseNumber: Number(row.case_number),
  subject: row.subject,
  description: row.description,
  category: row.category as CaseCategory,
  status: row.status as CaseStatus,
  priority: row.priority as CasePriority,
  machine:
    row.machine_id && row.machine_label
      ? {
          id: row.machine_id,
          label: row.machine_label,
          modelName: row.machine_model_name,
        }
      : null,
  assignee: toPerson(
    row.assignee_id,
    row.assignee_first_name,
    row.assignee_last_name,
    row.assignee_avatar_url,
  ),
  reporter: toPerson(
    row.reporter_id,
    row.reporter_first_name,
    row.reporter_last_name,
    row.reporter_avatar_url,
  ),
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
  resolvedAt: toIso(row.resolved_at),
  closedAt: toIso(row.closed_at),
  slaDueAt: toIso(row.sla_due_at),
  slaPausedAt: toIso(row.sla_paused_at),
});

export const toCaseMessage = (
  row: CaseMessageRow,
  attachments: CaseAttachment[] = [],
): CaseMessage => ({
  id: row.id,
  body: row.note,
  createdAt: row.created_at.toISOString(),
  author: toPerson(
    row.author_id,
    row.author_first_name,
    row.author_last_name,
    row.author_avatar_url,
  ),
  authorRole: row.author_role as CaseAuthorRole,
  isInternal: row.is_internal,
  attachments,
});

const toNamedPerson = (
  id: string | null,
  firstName: string | null,
  lastName: string | null,
): CasePerson | null =>
  id && (firstName || lastName) ? toPerson(id, firstName, lastName) : null;

export const toCaseEvent = (row: CaseEventRow): CaseEvent => ({
  id: row.id,
  type: row.type as CaseEventType,
  actor: toPerson(
    row.actor_id,
    row.actor_first_name,
    row.actor_last_name,
    row.actor_avatar_url,
  ),
  fromValue: row.from_value,
  toValue: row.to_value,
  fromPerson: toNamedPerson(
    row.from_value,
    row.from_person_first_name,
    row.from_person_last_name,
  ),
  toPerson: toNamedPerson(
    row.to_value,
    row.to_person_first_name,
    row.to_person_last_name,
  ),
  createdAt: row.created_at.toISOString(),
});

// Every status appears, at zero when the organisation has none.
export const toStatusCounts = (
  rows: StatusCountRow[],
): Record<CaseStatus, number> =>
  Object.fromEntries(
    CASE_STATUSES.map((status) => [
      status,
      Number(rows.find((row) => row.status === status)?.count ?? 0),
    ]),
  ) as Record<CaseStatus, number>;
