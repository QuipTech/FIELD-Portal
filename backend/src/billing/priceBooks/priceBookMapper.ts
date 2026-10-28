import { toIsoDay } from '../../common/utils/toIsoDay';
import { PinnedPriceBook } from '../pricing/pricingTypes';
import { PriceBandRow, PriceBookRow } from './priceBookRows';

const toCents = (value: string | null): number | null =>
  value === null ? null : Number(value);

export const toPinnedPriceBook = (
  book: PriceBookRow,
  bands: PriceBandRow[],
): PinnedPriceBook => ({
  id: book.id,
  planCode: book.plan_code,
  version: book.version,
  effectiveFrom: toIsoDay(book.effective_from),
  unitCents: toCents(book.unit_cents),
  minimumAnnualCents: toCents(book.minimum_annual_cents),
  bands: bands
    .filter((band) => band.price_book_id === book.id)
    .sort((a, b) => a.band_no - b.band_no)
    .map((band) => ({
      bandNo: band.band_no,
      lowerQty: band.lower_qty,
      upperQty: band.upper_qty,
      unitCents: Number(band.unit_cents),
    })),
});
