import { resolveStatusAfterPatch } from './caseAccessPolicy';
import { CasePatch } from './supportCases.repository';
import { CaseChange } from './recordCaseChange';
import { CasePriority, CaseStatus } from './types/supportCaseResponse';
import { UpdateSupportCaseDto } from './dto/updateSupportCaseDto';

export interface CaseBeforePatch {
  status: string;
  priority: string;
  assignee_id: string | null;
}

// What a staff PATCH actually changes, and the thread line for each
// change. Fields sent with their current value change nothing.
export const buildCasePatch = (
  existing: CaseBeforePatch,
  dto: UpdateSupportCaseDto,
  slaHours: Record<CasePriority, number>,
): { patch: CasePatch; events: CaseChange['events'] } => {
  const patch: CasePatch = {};
  const events: CaseChange['events'] = [];
  const currentStatus = existing.status as CaseStatus;

  const reassigns =
    dto.assigneeId !== undefined && dto.assigneeId !== existing.assignee_id;
  if (reassigns) {
    patch.assigneeId = dto.assigneeId;
    events.push(
      dto.assigneeId
        ? {
            type: 'assigned',
            fromValue: existing.assignee_id,
            toValue: dto.assigneeId,
          }
        : {
            type: 'unassigned',
            fromValue: existing.assignee_id,
            toValue: null,
          },
    );
  }

  const nextStatus = resolveStatusAfterPatch(
    currentStatus,
    existing.assignee_id,
    dto,
  );
  if (nextStatus !== currentStatus) {
    patch.status = nextStatus;
    events.push({
      type: 'status_changed',
      fromValue: currentStatus,
      toValue: nextStatus,
    });
  }

  if (dto.priority && dto.priority !== existing.priority) {
    const previous = existing.priority as CasePriority;
    patch.priority = dto.priority;
    patch.slaShiftHours = Math.round(
      slaHours[dto.priority] - slaHours[previous],
    );
    events.push({
      type: 'priority_changed',
      fromValue: previous,
      toValue: dto.priority,
    });
  }
  return { patch, events };
};
