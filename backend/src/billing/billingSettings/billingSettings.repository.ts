import { PoolClient } from 'pg';
import { ServiceDatabaseService } from '../../database/serviceDatabase.service';
import { PriceBandRow, PriceBookRow } from '../priceBooks/priceBookRows';

type Reader = Pick<ServiceDatabaseService, 'query'>;

export interface PriceBookListRow extends PriceBookRow {
  plan_name: string;
  subscription_count: string;
}

// Every version of every priced plan, newest first, with how many live
// subscriptions are pinned to it.
export const listPriceBooks = async (
  database: Reader,
): Promise<{ books: PriceBookListRow[]; bands: PriceBandRow[] }> => {
  const [books, bands] = await Promise.all([
    database.query<PriceBookListRow>(
      `SELECT b.id, b.plan_code, p.name AS plan_name, b.version, b.effective_from,
              b.unit_cents, b.minimum_annual_cents,
              (SELECT count(*) FROM billing.subscriptions s
               WHERE s.price_book_id = b.id AND s.deleted_at IS NULL
                 AND s.status <> 'cancelled') AS subscription_count
       FROM billing.price_books b
       JOIN platform.plans p ON p.code = b.plan_code
       WHERE b.deleted_at IS NULL
       ORDER BY p.sort_order, b.version DESC`,
    ),
    database.query<PriceBandRow>(
      `SELECT price_book_id, band_no, lower_qty, upper_qty, unit_cents
       FROM billing.price_bands WHERE deleted_at IS NULL`,
    ),
  ]);
  return { books: books.rows, bands: bands.rows };
};

// The next version for a plan; versions only go up.
export const insertPriceBook = async (
  client: PoolClient,
  params: {
    planCode: string;
    effectiveFrom: string;
    unitCents: number | null;
    minimumAnnualCents: number | null;
    createdBy: string;
    bands: {
      bandNo: number;
      lowerQty: number;
      upperQty: number | null;
      unitCents: number;
    }[];
  },
): Promise<{ id: string; version: number }> => {
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
    `price-book:${params.planCode}`,
  ]);
  const book = await client.query<{ id: string; version: number }>(
    `INSERT INTO billing.price_books
       (plan_code, version, effective_from, unit_cents, minimum_annual_cents, created_by)
     SELECT $1::varchar, coalesce(max(version), 0) + 1, $2::date, $3::bigint, $4::bigint, $5::uuid
     FROM billing.price_books WHERE plan_code = $1::varchar
     RETURNING id, version`,
    [
      params.planCode,
      params.effectiveFrom,
      params.unitCents,
      params.minimumAnnualCents,
      params.createdBy,
    ],
  );
  for (const band of params.bands) {
    await client.query(
      `INSERT INTO billing.price_bands (price_book_id, band_no, lower_qty, upper_qty, unit_cents)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        book.rows[0].id,
        band.bandNo,
        band.lowerQty,
        band.upperQty,
        band.unitCents,
      ],
    );
  }
  return book.rows[0];
};

export interface ReviewTaskRow {
  id: string;
  billing_account_id: string;
  account_name: string;
  type: string;
  reason: string;
  status: string;
  notes: string | null;
  details: Record<string, unknown>;
  resolved_at: Date | null;
  created_at: Date;
}

export const listReviewTasks = async (
  database: Reader,
  status: 'open' | 'closed' | null,
): Promise<ReviewTaskRow[]> => {
  const result = await database.query<ReviewTaskRow>(
    `SELECT t.id, t.billing_account_id, a.name AS account_name, t.type, t.reason,
            t.status, t.notes, t.details, t.resolved_at, t.created_at
     FROM billing.review_tasks t
     JOIN billing.billing_accounts a ON a.id = t.billing_account_id
     WHERE t.deleted_at IS NULL
       AND ($1::text IS NULL
            OR ($1 = 'open' AND t.status IN ('open', 'in_progress'))
            OR ($1 = 'closed' AND t.status IN ('resolved', 'dismissed')))
     ORDER BY (t.status IN ('open', 'in_progress')) DESC, t.created_at DESC
     LIMIT 200`,
    [status],
  );
  return result.rows;
};

export const updateReviewTask = async (
  client: PoolClient,
  params: { id: string; status: string; notes: string | null; userId: string },
): Promise<
  { billing_account_id: string; previous_status: string } | undefined
> => {
  const result = await client.query(
    `UPDATE billing.review_tasks t
     SET status = $2::varchar, notes = coalesce($3::text, t.notes), updated_at = now(),
         resolved_by = CASE WHEN $2::varchar IN ('resolved', 'dismissed') THEN $4::uuid ELSE NULL END,
         resolved_at = CASE WHEN $2::varchar IN ('resolved', 'dismissed') THEN now() ELSE NULL END
     FROM (SELECT id, status AS previous_status FROM billing.review_tasks WHERE id = $1 FOR UPDATE) old
     WHERE t.id = old.id AND t.deleted_at IS NULL
     RETURNING t.billing_account_id, old.previous_status`,
    [params.id, params.status, params.notes, params.userId],
  );
  return result.rows[0];
};
