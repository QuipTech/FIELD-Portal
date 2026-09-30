import {
  CASE_STATUSES,
  CaseCategory,
  CaseMessage,
  CasePerson,
  CasePriority,
  CaseStatus,
  SupportCase,
} from './types/supportCaseResponse';
import {
  CaseMessageRow,
  StatusCountRow,
  SupportCaseRow,
} from './types/supportCaseRows';

export const toPerson = (
  id: string | null,
  firstName: string | null,
  lastName: string | null,
): CasePerson | null =>
  id ? { id, name: `${firstName ?? ''} ${lastName ?? ''}`.trim() } : null;

export const toSupportCase = (row: SupportCaseRow): SupportCase => ({
  id: row.id,
  caseNumber: Number(row.case_number),
  subject: row.subject,
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
  ),
  reporter: toPerson(
    row.reporter_id,
    row.reporter_first_name,
    row.reporter_last_name,
  ),
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
  resolvedAt: row.resolved_at?.toISOString() ?? null,
});

export const toCaseMessage = (row: CaseMessageRow): CaseMessage => ({
  id: row.id,
  body: row.note,
  createdAt: row.created_at.toISOString(),
  author: toPerson(row.author_id, row.author_first_name, row.author_last_name),
  authorRole:
    row.author_id !== null && row.author_id === row.case_reporter_id
      ? 'reporter'
      : 'support',
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
