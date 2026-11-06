import { escapeLikePattern } from '../common/utils/escapeLikePattern';
import { PaginationQueryDto } from '../common/dto/paginationQueryDto';
import {
  MachineScope,
  linkedMachineVisibleSql,
} from '../machineSharing/access/machineScope';
import { CaseStatusFilter } from './dto/listSupportCasesQueryDto';
import { CasePriority } from './types/supportCaseResponse';

// The customer case list's filters (supportCases.repository).

export interface CaseListFilters extends PaginationQueryDto {
  status: CaseStatusFilter;
  priority?: CasePriority;
  search?: string;
  machineId?: string;
}

const STATUS_CONDITIONS: Record<CaseStatusFilter, string | null> = {
  active: `c.status IN ('new', 'open', 'waiting_on_customer')`,
  new: `c.status = 'new'`,
  open: `c.status = 'open'`,
  waiting_on_customer: `c.status = 'waiting_on_customer'`,
  resolved: `c.status = 'resolved'`,
  closed: `c.status = 'closed'`,
  all: null,
};

// WHERE clause and its parameters for the list's filters ($1 = the
// caller's organisation): its cases about no machine or a visible one, and
// cases its people raised on machines shared with them (RLS).
export const buildCaseFilter = (
  tenantId: string,
  scope: MachineScope,
  filters: CaseListFilters,
) => {
  const params: unknown[] = [tenantId];
  const conditions = [
    'c.deleted_at IS NULL',
    linkedMachineVisibleSql('c.machine_id', 'c.tenant_id', '$1', scope),
  ];
  const statusCondition = STATUS_CONDITIONS[filters.status];
  if (statusCondition) conditions.push(statusCondition);
  if (filters.priority) {
    params.push(filters.priority);
    conditions.push(`c.priority = $${params.length}`);
  }
  if (filters.machineId) {
    params.push(filters.machineId);
    conditions.push(`c.machine_id = $${params.length}`);
  }
  if (filters.search) {
    const caseNumber = filters.search.replace(/^#/, '');
    params.push(`%${escapeLikePattern(filters.search)}%`, caseNumber);
    conditions.push(
      `(c.subject ILIKE $${params.length - 1} OR c.case_number::text = $${params.length})`,
    );
  }
  return { where: conditions.join(' AND '), params };
};
