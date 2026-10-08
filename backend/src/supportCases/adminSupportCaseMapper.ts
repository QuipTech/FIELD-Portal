import { toPerson, toPersonName } from './supportCaseMapper';
import {
  AdminCaseStats,
  AdminSupportCaseListItem,
  SupportStaffMember,
} from './types/adminSupportCaseResponse';
import { CasePriority, CaseStatus } from './types/supportCaseResponse';
import {
  AdminCaseListRow,
  AdminCaseStatsRow,
  SupportStaffRow,
} from './types/supportCaseRows';

export const toAdminCaseListItem = (
  row: AdminCaseListRow,
): AdminSupportCaseListItem => ({
  id: row.id,
  caseNumber: Number(row.case_number),
  subject: row.subject,
  status: row.status as CaseStatus,
  priority: row.priority as CasePriority,
  company: { id: row.tenant_id, name: row.tenant_name },
  reporterName:
    toPersonName(row.reporter_first_name, row.reporter_last_name) || null,
  assignee: toPerson(
    row.assignee_id,
    row.assignee_first_name,
    row.assignee_last_name,
    row.assignee_avatar_url,
  ),
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
  slaDueAt: row.sla_due_at?.toISOString() ?? null,
  slaPausedAt: row.sla_paused_at?.toISOString() ?? null,
  isUnread: row.is_unread,
});

export const toAdminCaseStats = (row: AdminCaseStatsRow): AdminCaseStats => ({
  unassigned: Number(row.unassigned),
  open: Number(row.open),
  waitingOnCustomer: Number(row.waiting_on_customer),
  slaBreached: Number(row.sla_breached),
  assignedToMe: Number(row.assigned_to_viewer),
  allOpen: Number(row.all_open),
});

export const toSupportStaffMember = (
  row: SupportStaffRow,
): SupportStaffMember => ({
  id: row.id,
  name: toPersonName(row.first_name, row.last_name),
  email: row.email,
  avatarUrl: row.avatar_url,
  isAdmin: row.is_admin,
  openCaseCount: Number(row.open_case_count),
});
