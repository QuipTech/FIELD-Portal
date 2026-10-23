import { calculateFleetPriceCents, findBandRateCents } from './fleetPrice';
import { ASSET_PRO_V1 } from './priceBookV1Fixture';

const price = (machines: number) =>
  calculateFleetPriceCents(ASSET_PRO_V1.bands, machines);

describe('price(n), ASSET_PRO by fleet size', () => {
  it('T1: 2 machines cost A$70.00 (no minimum)', () => {
    expect(price(2)).toBe(7000);
  });

  it('T2: 15 machines cost A$525.00', () => {
    expect(price(15)).toBe(52500);
  });

  it('T3: 25 machines cost A$875.00, then 26 cost A$754.00 (all at A$29)', () => {
    expect(price(25)).toBe(87500);
    expect(price(26)).toBe(75400);
    expect(findBandRateCents(ASSET_PRO_V1.bands, 26)).toBe(2900);
  });

  it('T4: 50 machines cost A$1,450.00', () => {
    expect(price(50)).toBe(145000);
  });

  it('T5: 99 machines cost A$2,871.00, then 100 cost A$2,500.00 (all at A$25)', () => {
    expect(price(99)).toBe(287100);
    expect(price(100)).toBe(250000);
  });

  it('T6: 200 machines cost A$5,000.00', () => {
    expect(price(200)).toBe(500000);
  });

  it('T7: 499 machines cost A$12,475.00', () => {
    expect(price(499)).toBe(1247500);
  });

  it('T8: 500 machines self-serve keep the top rate, A$12,500.00', () => {
    expect(price(500)).toBe(1250000);
  });

  it('charges nothing for an empty fleet', () => {
    expect(price(0)).toBe(0);
  });

  it('refuses a fractional or negative count', () => {
    expect(() => price(2.5)).toThrow(RangeError);
    expect(() => price(-1)).toThrow(RangeError);
  });

  it('reads the rate from the bands it is given, not a literal', () => {
    const repriced = ASSET_PRO_V1.bands.map((band) => ({
      ...band,
      unitCents: band.unitCents + 100,
    }));
    expect(calculateFleetPriceCents(repriced, 26)).toBe(26 * 3000);
  });

  it('uses an open-ended top band when the price book has one', () => {
    const openEnded = [
      { bandNo: 1, lowerQty: 1, upperQty: null, unitCents: 1000 },
    ];
    expect(calculateFleetPriceCents(openEnded, 10000)).toBe(10000000);
  });
});
