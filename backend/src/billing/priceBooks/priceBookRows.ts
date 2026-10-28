// bigint columns arrive from pg as strings.
export interface PriceBookRow {
  id: string;
  plan_code: string;
  version: number;
  effective_from: Date;
  unit_cents: string | null;
  minimum_annual_cents: string | null;
}

export interface PriceBandRow {
  price_book_id: string;
  band_no: number;
  lower_qty: number;
  upper_qty: number | null;
  unit_cents: string;
}
