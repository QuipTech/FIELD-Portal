import { ServiceDatabaseService } from '../../database/serviceDatabase.service';
import { PriceBandRow, PriceBookRow } from './priceBookRows';

const BOOK_COLUMNS = `id, plan_code, version, effective_from, unit_cents,
  minimum_annual_cents`;

export const findPriceBookById = async (
  serviceDatabase: ServiceDatabaseService,
  priceBookId: string,
): Promise<PriceBookRow | undefined> => {
  const result = await serviceDatabase.query<PriceBookRow>(
    `SELECT ${BOOK_COLUMNS} FROM billing.price_books
     WHERE id = $1 AND deleted_at IS NULL`,
    [priceBookId],
  );
  return result.rows[0];
};

// The version a new sign-up or renewal pins: the highest version already
// in effect on that day.
export const findPriceBookInEffect = async (
  serviceDatabase: ServiceDatabaseService,
  planCode: string,
  onDay: string,
): Promise<PriceBookRow | undefined> => {
  const result = await serviceDatabase.query<PriceBookRow>(
    `SELECT ${BOOK_COLUMNS} FROM billing.price_books
     WHERE plan_code = $1 AND effective_from <= $2::date AND deleted_at IS NULL
     ORDER BY version DESC
     LIMIT 1`,
    [planCode, onDay],
  );
  return result.rows[0];
};

export const listPriceBands = async (
  serviceDatabase: ServiceDatabaseService,
  priceBookId: string,
): Promise<PriceBandRow[]> => {
  const result = await serviceDatabase.query<PriceBandRow>(
    `SELECT price_book_id, band_no, lower_qty, upper_qty, unit_cents
     FROM billing.price_bands
     WHERE price_book_id = $1 AND deleted_at IS NULL
     ORDER BY band_no`,
    [priceBookId],
  );
  return result.rows;
};
