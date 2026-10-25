import { ASSET_PRO_V1 } from '../billing/pricing/priceBookV1Fixture';
import { quoteActivation } from './activationQuote';

const bands = ASSET_PRO_V1.bands;

describe('activation quote', () => {
  it('prices the first machine at A$35 a month', () => {
    expect(
      quoteActivation({ bands, activeToday: 0, peakSoFar: 0, adding: 1 }),
    ).toEqual({
      machinesAfter: 1,
      billableBefore: 0,
      billableAfter: 1,
      rateBeforeCents: null,
      rateAfterCents: 3500,
      monthlyBeforeCents: 0,
      monthlyAfterCents: 3500,
    });
  });

  it('moves the whole fleet to the lower rate when it crosses a band', () => {
    const quote = quoteActivation({
      bands,
      activeToday: 25,
      peakSoFar: 25,
      adding: 1,
    });
    expect(quote.rateBeforeCents).toBe(3500);
    expect(quote.monthlyBeforeCents).toBe(87500);
    expect(quote.rateAfterCents).toBe(2900);
    expect(quote.monthlyAfterCents).toBe(75400);
  });

  it('adds nothing this month while the month already peaked higher', () => {
    const quote = quoteActivation({
      bands,
      activeToday: 2,
      peakSoFar: 4,
      adding: 1,
    });
    expect(quote.billableAfter).toBe(4);
    expect(quote.monthlyAfterCents).toBe(quote.monthlyBeforeCents);
  });
});
