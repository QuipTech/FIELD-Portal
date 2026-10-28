import { findPriceBandProblems } from './priceBandRules';
import { ASSET_PRO_V1 } from './priceBookV1Fixture';

describe('findPriceBandProblems', () => {
  it('accepts the version 1 bands', () => {
    expect(findPriceBandProblems(ASSET_PRO_V1.bands)).toEqual([]);
  });

  it('requires at least one band', () => {
    expect(findPriceBandProblems([])).toEqual([
      'At least one band is required.',
    ]);
  });

  it('requires the first band to start at 1', () => {
    expect(
      findPriceBandProblems([
        { bandNo: 1, lowerQty: 2, upperQty: null, unitCents: 3500 },
      ]),
    ).toContain('The first band must start at 1 machine.');
  });

  it('finds a gap between bands', () => {
    expect(
      findPriceBandProblems([
        { bandNo: 1, lowerQty: 1, upperQty: 25, unitCents: 3500 },
        { bandNo: 2, lowerQty: 27, upperQty: null, unitCents: 2900 },
      ]),
    ).toContain('Band 2 must start at 26 machines.');
  });

  it('allows only the last band to be open-ended', () => {
    expect(
      findPriceBandProblems([
        { bandNo: 1, lowerQty: 1, upperQty: null, unitCents: 3500 },
        { bandNo: 2, lowerQty: 26, upperQty: null, unitCents: 2900 },
      ]),
    ).toContain('Band 1: only the last band can be open-ended.');
  });

  it('requires whole-cent rates', () => {
    expect(
      findPriceBandProblems([
        { bandNo: 1, lowerQty: 1, upperQty: null, unitCents: 35.5 },
      ]),
    ).toContain('Band 1: the rate must be whole cents.');
  });
});
