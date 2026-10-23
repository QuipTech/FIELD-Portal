import { CaseSla, CaseSlaState } from './types/supportCaseResponse';

// "Due soon" in the last quarter of the time a case is allowed: due time
// minus creation, which already includes time added for pauses and
// priority changes (P1's 4 hours → the last hour).
export const DUE_SOON_SHARE = 0.25;
const MS_PER_MINUTE = 60_000;

export interface CaseSlaFields {
  status: string;
  created_at: Date;
  resolved_at: Date | null;
  sla_due_at: Date | null;
  sla_paused_at: Date | null;
  first_response_at: Date | null;
}

const FINISHED_STATUSES = ['resolved', 'closed'];

const toState = (row: CaseSlaFields, now: Date): CaseSlaState | null => {
  if (!row.sla_due_at) return null;
  const due = row.sla_due_at.getTime();
  if (FINISHED_STATUSES.includes(row.status)) {
    const finishedAt = row.resolved_at?.getTime() ?? now.getTime();
    return finishedAt <= due ? 'met' : 'missed';
  }
  if (row.sla_paused_at) return 'paused';
  if (now.getTime() > due) return 'breached';
  const allowed = due - row.created_at.getTime();
  return due - now.getTime() <= allowed * DUE_SOON_SHARE
    ? 'due_soon'
    : 'on_track';
};

// The SLA clock runs from creation until the case is resolved and stops
// while waiting on the customer (trigger, migration 0069).
export const toCaseSla = (row: CaseSlaFields, now = new Date()): CaseSla => {
  const state = toState(row, now);
  const isRunning =
    state === 'on_track' || state === 'due_soon' || state === 'breached';
  return {
    state,
    dueAt: row.sla_due_at?.toISOString() ?? null,
    pausedAt: row.sla_paused_at?.toISOString() ?? null,
    firstResponseAt: row.first_response_at?.toISOString() ?? null,
    minutesRemaining:
      isRunning && row.sla_due_at
        ? Math.floor((row.sla_due_at.getTime() - now.getTime()) / MS_PER_MINUTE)
        : null,
  };
};
