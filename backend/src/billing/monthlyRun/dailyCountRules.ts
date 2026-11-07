import {
  BillableInterval,
  countIntervalsOnDay,
} from '../billingCalendar/billableInterval';
import { DailyBillableCount } from './monthlyRunTypes';

// Monthly run, step 1 (the nightly snapshot): what was billable each day.
export const buildDailyCounts = (
  machines: BillableInterval[],
  seats: BillableInterval[],
  days: string[],
): DailyBillableCount[] =>
  days.map((day) => ({
    day,
    activeMachines: countIntervalsOnDay(machines, day),
    techSeats: countIntervalsOnDay(seats, day),
  }));

// The peak's input without machines that paid their own final charge (billing
// spec section 3, rule 3a). The written snapshots stay as they are.
export const withoutFinalChargedMachines = (
  counts: DailyBillableCount[],
  charged: BillableInterval[],
): DailyBillableCount[] =>
  counts.map((count) => ({
    ...count,
    activeMachines: Math.max(
      count.activeMachines - countIntervalsOnDay(charged, count.day),
      0,
    ),
  }));
