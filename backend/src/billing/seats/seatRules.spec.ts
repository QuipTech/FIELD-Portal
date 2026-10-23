import { addDaysToDay } from '../billingCalendar/billingDay';
import { calculateTechMonthlyCents } from '../pricing/techPricing';
import { TECH_SEAT_CENTS_V1 } from '../pricing/priceBookV1Fixture';
import {
  countSeatsOnDay,
  planSeatAddition,
  planSeatBillingEnd,
  SeatInterval,
} from './seatRules';

const seat = (overrides: Partial<SeatInterval>): SeatInterval => ({
  id: 'seat-1',
  userId: 'user-1',
  startedOn: '2026-04-01',
  billingEnd: null,
  ...overrides,
});

const aprilDays = Array.from({ length: 30 }, (_, index) =>
  addDaysToDay('2026-04-01', index),
);

describe('seat rules', () => {
  it('T14: 2 seats, a third added 16 April → peak 3 → A$147.00', () => {
    const seats = [
      seat({ id: 'a', userId: 'a' }),
      seat({ id: 'b', userId: 'b' }),
      seat({ id: 'c', userId: 'c', startedOn: '2026-04-16' }),
    ];
    const peak = Math.max(
      ...aprilDays.map((day) => countSeatsOnDay(seats, day)),
    );
    expect(peak).toBe(3);
    expect(calculateTechMonthlyCents(peak, TECH_SEAT_CENTS_V1)).toBe(14700);
  });

  it('keeps a removed seat billable to the end of the month', () => {
    const billingEnd = planSeatBillingEnd('2026-04-10');
    expect(billingEnd).toBe('2026-05-01');
    const seats = [seat({ billingEnd })];
    expect(countSeatsOnDay(seats, '2026-04-30')).toBe(1);
    expect(countSeatsOnDay(seats, '2026-05-01')).toBe(0);
  });

  it('refuses a second seat for a user who holds one', () => {
    expect(planSeatAddition([seat({})], '2026-04-10')).toEqual({
      kind: 'alreadyHeld',
    });
  });

  it('reinstates a seat removed this month instead of adding another', () => {
    const removed = seat({ id: 'removed', billingEnd: '2026-05-01' });
    expect(planSeatAddition([removed], '2026-04-20')).toEqual({
      kind: 'reinstate',
      seatId: 'removed',
    });
  });

  it('creates a new seat once the old one has stopped counting', () => {
    const ended = seat({ billingEnd: '2026-04-01', startedOn: '2026-03-01' });
    expect(planSeatAddition([ended], '2026-04-20')).toEqual({ kind: 'create' });
    expect(planSeatAddition([], '2026-04-20')).toEqual({ kind: 'create' });
  });
});
