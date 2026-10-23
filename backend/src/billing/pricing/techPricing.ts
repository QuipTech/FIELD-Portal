import { divideRoundHalfUp } from './roundHalfUp';

const MONTHS_IN_TERM = 12;

const assertSeatCount = (seats: number) => {
  if (!Number.isSafeInteger(seats) || seats < 0) {
    throw new RangeError('seats must be a non-negative whole number');
  }
};

// TECH monthly: the month's peak seats × the seat price.
export const calculateTechMonthlyCents = (
  peakSeats: number,
  seatCents: number,
): number => {
  assertSeatCount(peakSeats);
  return peakSeats * seatCents;
};

// TECH annual: seats × the seat price × ANNUAL_MONTHS_CHARGED, up front.
export const calculateTechAnnualUpFrontCents = (
  committedSeats: number,
  seatCents: number,
  monthsCharged: number,
): number => {
  assertSeatCount(committedSeats);
  return committedSeats * seatCents * monthsCharged;
};

// The per-seat rate for seats above the annual commitment in a month:
// seat price × monthsCharged / 12, rounded half-up to the cent. Rounded per
// seat so the invoice line stays quantity × unit price.
export const calculateTechExtraSeatUnitCents = (
  seatCents: number,
  monthsCharged: number,
): number => divideRoundHalfUp(seatCents * monthsCharged, MONTHS_IN_TERM);
