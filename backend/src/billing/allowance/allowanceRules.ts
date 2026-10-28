// Pure fair-use rules (spec section 6). Allowances are pooled across the
// billing account; reaching one never blocks, throttles or degrades work.

export type AllowanceMetric = 'ai_turns' | 'storage_bytes' | 'ingest_pages';
export type ThresholdState = 'ok' | 'notified' | 'flagged';

export const ALLOWANCE_METRICS: AllowanceMetric[] = [
  'ai_turns',
  'storage_bytes',
  'ingest_pages',
];

export interface AllowanceInputs {
  // Average active machines over the month so far.
  averageActiveMachines: number;
  // TECH seats and paid personal TECH users on the account.
  techUsers: number;
  config: {
    AI_ALLOWANCE_PER_ACTIVE_MACHINE: number;
    AI_ALLOWANCE_PER_TECH_USER: number;
    STORAGE_ALLOWANCE_PER_ACTIVE_MACHINE: number;
    INGEST_ALLOWANCE: number;
  };
}

// The month's allowance for a metric. AI turns are per machine plus per
// TECH user; storage and ingestion are per machine.
export const calculateAllowance = (
  metric: AllowanceMetric,
  { averageActiveMachines, techUsers, config }: AllowanceInputs,
): number => {
  switch (metric) {
    case 'ai_turns':
      return Math.round(
        config.AI_ALLOWANCE_PER_ACTIVE_MACHINE * averageActiveMachines +
          config.AI_ALLOWANCE_PER_TECH_USER * techUsers,
      );
    case 'storage_bytes':
      return Math.round(
        config.STORAGE_ALLOWANCE_PER_ACTIVE_MACHINE * averageActiveMachines,
      );
    case 'ingest_pages':
      return Math.round(config.INGEST_ALLOWANCE * averageActiveMachines);
  }
};

// Share of the allowance used; any use against a zero allowance is over.
export const usageRatio = (used: number, allowance: number): number =>
  allowance > 0 ? used / allowance : used > 0 ? Number.POSITIVE_INFINITY : 0;

const RANK: Record<ThresholdState, number> = { ok: 0, notified: 1, flagged: 2 };

// The state the month has now reached; it only ever moves up within a
// month, so each threshold notifies once.
export const nextThresholdState = (
  current: ThresholdState,
  ratio: number,
  thresholds: { notifyAt: number; flagAt: number },
): ThresholdState => {
  const reached: ThresholdState =
    ratio >= thresholds.flagAt
      ? 'flagged'
      : ratio >= thresholds.notifyAt
        ? 'notified'
        : 'ok';
  return RANK[reached] > RANK[current] ? reached : current;
};

// Months in a row ending over 100%, counting the month just closed. Two
// in a row raises a plan review (T26); there is never an automatic charge.
export const closeConsecutiveOver = (
  previousConsecutive: number,
  used: number,
  allowance: number,
): number => (used > allowance ? previousConsecutive + 1 : 0);

export const PLAN_REVIEW_AFTER_MONTHS = 2;
