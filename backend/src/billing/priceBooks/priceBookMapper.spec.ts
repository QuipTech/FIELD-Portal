import { toPinnedPriceBook } from './priceBookMapper';

describe('toPinnedPriceBook', () => {
  it('turns bigint strings into cents and orders the bands', () => {
    const book = {
      id: 'book-1',
      plan_code: 'ASSET_PRO',
      version: 1,
      effective_from: new Date(2026, 0, 1),
      unit_cents: null,
      minimum_annual_cents: null,
    };
    const bands = [
      {
        price_book_id: 'book-1',
        band_no: 2,
        lower_qty: 26,
        upper_qty: 99,
        unit_cents: '2900',
      },
      {
        price_book_id: 'book-1',
        band_no: 1,
        lower_qty: 1,
        upper_qty: 25,
        unit_cents: '3500',
      },
      {
        price_book_id: 'other',
        band_no: 1,
        lower_qty: 1,
        upper_qty: null,
        unit_cents: '1',
      },
    ];

    expect(toPinnedPriceBook(book, bands)).toEqual({
      id: 'book-1',
      planCode: 'ASSET_PRO',
      version: 1,
      effectiveFrom: '2026-01-01',
      unitCents: null,
      minimumAnnualCents: null,
      bands: [
        { bandNo: 1, lowerQty: 1, upperQty: 25, unitCents: 3500 },
        { bandNo: 2, lowerQty: 26, upperQty: 99, unitCents: 2900 },
      ],
    });
  });

  it('keeps flat prices and the Enterprise minimum', () => {
    const pinned = toPinnedPriceBook(
      {
        id: 'enterprise-1',
        plan_code: 'ENTERPRISE',
        version: 1,
        effective_from: new Date(2026, 0, 1),
        unit_cents: null,
        minimum_annual_cents: '500000',
      },
      [],
    );
    expect(pinned.minimumAnnualCents).toBe(500000);
    expect(pinned.bands).toEqual([]);
  });
});
