import { ForbiddenException } from '@nestjs/common';
import { PLATFORM_PERMISSION_CODE } from '../auth/systemRoleNames';
import { CaseStatus } from './types/supportCaseResponse';

// Every support-case rule in one place, with no I/O, so it is enforced the
// same way by the REST endpoints and the socket gateway, and unit-tested.

export const SUPPORT_AGENT_PERMISSION = 'support.agent';
export const SUPPORT_CREATE_PERMISSION = 'support.create';

export const REOPEN_WINDOW_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export type CaseViewerRole = 'admin' | 'assignee' | 'customer';

export interface CaseViewer {
  userId: string;
  tenantId: string;
  permissions: string[];
}

export interface CaseOwnership {
  tenantId: string;
  assigneeId: string | null;
}

export interface CasePatchRequest {
  status?: CaseStatus;
  priority?: string;
  assigneeId?: string | null;
}

const NO_STATUS_CHANGE_MESSAGE =
  'Only the assigned support person or an admin can change the status.';
const ADMIN_ONLY_MESSAGE =
  'Only an admin can assign cases or change their priority.';
const CLOSE_ADMIN_ONLY_MESSAGE = 'Only an admin can close a case.';
const NEW_STATUS_MESSAGE =
  'A case is "new" only until it is assigned. Unassign it instead.';

export const isSupportAdmin = (permissions: string[]): boolean =>
  permissions.includes(PLATFORM_PERMISSION_CODE);

export const isSupportStaff = (permissions: string[]): boolean =>
  isSupportAdmin(permissions) || permissions.includes(SUPPORT_AGENT_PERMISSION);

// null means "not yours to see": callers answer 404, never 403, so a case
// number from elsewhere gives nothing away.
export const resolveCaseViewerRole = (
  viewer: CaseViewer,
  supportCase: CaseOwnership,
): CaseViewerRole | null => {
  if (isSupportAdmin(viewer.permissions)) return 'admin';
  if (
    viewer.permissions.includes(SUPPORT_AGENT_PERMISSION) &&
    supportCase.assigneeId === viewer.userId
  ) {
    return 'assignee';
  }
  if (
    viewer.permissions.includes(SUPPORT_CREATE_PERMISSION) &&
    supportCase.tenantId === viewer.tenantId
  ) {
    return 'customer';
  }
  return null;
};

export const canSeeInternalNotes = (role: CaseViewerRole): boolean =>
  role !== 'customer';

// Throws unless this role may make every change in the patch.
export const assertCanPatchCase = (
  role: CaseViewerRole,
  patch: CasePatchRequest,
): void => {
  const changesAssignment = patch.assigneeId !== undefined;
  const changesPriority = patch.priority !== undefined;
  if ((changesAssignment || changesPriority) && role !== 'admin') {
    throw new ForbiddenException(ADMIN_ONLY_MESSAGE);
  }
  if (patch.status === undefined) return;
  if (role === 'customer')
    throw new ForbiddenException(NO_STATUS_CHANGE_MESSAGE);
  if (patch.status === 'new') throw new ForbiddenException(NEW_STATUS_MESSAGE);
  if (patch.status === 'closed' && role !== 'admin') {
    throw new ForbiddenException(CLOSE_ADMIN_ONLY_MESSAGE);
  }
};

// "new" means unassigned and not yet picked up: assigning a new case opens
// it, and unassigning an open one puts it back in the queue as new. An
// explicit status in the same request wins.
export const resolveStatusAfterPatch = (
  current: CaseStatus,
  currentAssigneeId: string | null,
  patch: CasePatchRequest,
): CaseStatus => {
  if (patch.status) return patch.status;
  if (
    patch.assigneeId === undefined ||
    patch.assigneeId === currentAssigneeId
  ) {
    return current;
  }
  if (patch.assigneeId !== null && current === 'new') return 'open';
  if (patch.assigneeId === null && current === 'open') return 'new';
  return current;
};

// A customer's reply restarts a case that was waiting on them.
export const resolveStatusAfterCustomerReply = (
  current: CaseStatus,
): CaseStatus => (current === 'waiting_on_customer' ? 'open' : current);

// Replies need an active case; staff may still leave internal notes on a
// resolved one.
export const canPostToCase = (
  status: CaseStatus,
  isInternal: boolean,
): boolean => status !== 'closed' && (status !== 'resolved' || isInternal);

export const canReopenCase = (
  status: CaseStatus,
  resolvedAt: Date | null,
  now: Date,
): boolean =>
  status === 'resolved' &&
  resolvedAt !== null &&
  now.getTime() - resolvedAt.getTime() <= REOPEN_WINDOW_DAYS * DAY_MS;

// Reopening goes back to the person who had it, or to the queue.
export const resolveReopenedStatus = (assigneeId: string | null): CaseStatus =>
  assigneeId ? 'open' : 'new';
