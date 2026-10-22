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
