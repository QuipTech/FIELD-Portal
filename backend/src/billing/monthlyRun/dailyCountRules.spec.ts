import { withoutFinalChargedMachines } from './dailyCountRules';
import { findMonthlyPeak } from './monthlyLineCalculation';

// Billing spec section 3, rule 3a: a machine that paid its own final charge
// isn't also in the month's peak.
describe('withoutFinalChargedMachines', () => {
  const counts = [
    { day: '2026-11-01', activeMachines: 10, techSeats: 2 },
    { day: '2026-11-02', activeMachines: 12, techSeats: 2 },
    { day: '2026-11-03', activeMachines: 11, techSeats: 2 },
  ];
  const peakOf = (adjusted: typeof counts) =>
    findMonthlyPeak(adjusted, (count) => count.activeMachines).count;

  it('takes a charged machine off every day its interval covered', () => {
    const adjusted = withoutFinalChargedMachines(counts, [
      { startedOn: '2026-10-25', billingEnd: '2026-12-01' },
    ]);
    expect(adjusted.map((count) => count.activeMachines)).toEqual([9, 11, 10]);
    expect(peakOf(adjusted)).toBe(11);
  });

  it('only touches the days it was counted, and never seats', () => {
    const adjusted = withoutFinalChargedMachines(counts, [
      { startedOn: '2026-11-03', billingEnd: '2026-12-01' },
    ]);
    expect(adjusted.map((count) => count.activeMachines)).toEqual([10, 12, 10]);
    expect(adjusted.every((count) => count.techSeats === 2)).toBe(true);
    expect(peakOf(adjusted)).toBe(12);
  });

  it('changes nothing when no machine paid separately, and never goes negative', () => {
    expect(withoutFinalChargedMachines(counts, [])).toEqual(counts);
    expect(
      withoutFinalChargedMachines(
        [{ day: '2026-11-01', activeMachines: 0, techSeats: 0 }],
        [{ startedOn: '2026-10-25', billingEnd: '2026-12-01' }],
      )[0].activeMachines,
    ).toBe(0);
  });
});
