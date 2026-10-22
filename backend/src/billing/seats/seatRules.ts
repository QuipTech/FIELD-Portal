import { countIntervalsOnDay } from '../billingCalendar/billableInterval';
import { firstDayOfNextMonth } from '../billingCalendar/billingDay';

export interface SeatInterval {
  id: string;
  userId: string;
  startedOn: string;
  // null = still held; otherwise the first day it no longer counts.
  billingEnd: string | null;
}

export type SeatAddition =
  | { kind: 'create' }
  // Removed this month but not yet ended: keep the same seat, no double
  // count.
  | { kind: 'reinstate'; seatId: string }
  | { kind: 'alreadyHeld' };

export const planSeatAddition = (
  userSeats: SeatInterval[],
  today: string,
): SeatAddition => {
  if (userSeats.some((seat) => seat.billingEnd === null)) {
    return { kind: 'alreadyHeld' };
  }
  const stillCounting = userSeats.find(
    (seat) => seat.billingEnd !== null && today < seat.billingEnd,
  );
  return stillCounting
    ? { kind: 'reinstate', seatId: stillCounting.id }
    : { kind: 'create' };
};

// A removed seat still counts for the rest of this month.
export const planSeatBillingEnd = (today: string): string =>
  firstDayOfNextMonth(today);

// The same rule as machines (billingCalendar/billableInterval.ts).
export const countSeatsOnDay = (seats: SeatInterval[], day: string): number =>
  countIntervalsOnDay(seats, day);
