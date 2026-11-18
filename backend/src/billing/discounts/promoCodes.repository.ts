import { PoolClient } from 'pg';
import { ServiceDatabaseService } from '../../database/serviceDatabase.service';
import { DiscountType } from './discountRules';

type Reader = Pick<ServiceDatabaseService, 'query'>;

export interface PromoCodeRow {
  id: string;
  code: string;
  description: string;
  discount_type: DiscountType;
  discount_value: number;
  duration_months: number | null;
  valid_from: string | null;
  valid_until: string | null;
  max_redemptions: number | null;
  redemptions_count: number;
  new_customers_only: boolean;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

const PROMO_COLUMNS = `p.id, p.code, p.description, p.discount_type, p.discount_value,
  p.duration_months, p.valid_from::text AS valid_from, p.valid_until::text AS valid_until,
  p.max_redemptions, p.redemptions_count, p.new_customers_only, p.active,
  p.created_at, p.updated_at`;

export const listPromoCodes = async (
  database: Reader,
): Promise<PromoCodeRow[]> => {
  const result = await database.query<PromoCodeRow>(
    `SELECT ${PROMO_COLUMNS} FROM billing.promo_codes p
     WHERE p.deleted_at IS NULL ORDER BY p.active DESC, p.created_at DESC`,
  );
  return result.rows;
};

export const findPromoCode = async (
  database: Reader,
  promoCodeId: string,
): Promise<PromoCodeRow | undefined> => {
  const result = await database.query<PromoCodeRow>(
    `SELECT ${PROMO_COLUMNS} FROM billing.promo_codes p
     WHERE p.id = $1 AND p.deleted_at IS NULL`,
    [promoCodeId],
  );
  return result.rows[0];
};

// Case-insensitive lookup; `lock` takes the row for a redemption.
export const findPromoCodeByCode = async (
  database: Reader,
  code: string,
  lock = false,
): Promise<PromoCodeRow | undefined> => {
  const result = await database.query<PromoCodeRow>(
    `SELECT ${PROMO_COLUMNS} FROM billing.promo_codes p
     WHERE lower(p.code) = lower($1) AND p.deleted_at IS NULL
     ${lock ? 'FOR UPDATE' : ''}`,
    [code],
  );
  return result.rows[0];
};

export interface PromoCodeInput {
  code: string;
  description: string;
  discountType: DiscountType;
  discountValue: number;
  durationMonths: number | null;
  validFrom: string | null;
  validUntil: string | null;
  maxRedemptions: number | null;
  newCustomersOnly: boolean;
}

export const insertPromoCode = async (
  client: PoolClient,
  input: PromoCodeInput,
  createdBy: string,
): Promise<string> => {
  const result = await client.query<{ id: string }>(
    `INSERT INTO billing.promo_codes
       (code, description, discount_type, discount_value, duration_months,
        valid_from, valid_until, max_redemptions, new_customers_only, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
    [
      input.code,
      input.description,
      input.discountType,
      input.discountValue,
      input.durationMonths,
      input.validFrom,
      input.validUntil,
      input.maxRedemptions,
      input.newCustomersOnly,
      createdBy,
    ],
  );
  return result.rows[0].id;
};

// The terms an edit may change. The code itself and its discount stay as
// they were once anyone has redeemed it, so a customer's deal never
// changes under them (checked by the service).
export const updatePromoCode = async (
  client: PoolClient,
  promoCodeId: string,
  input: Omit<PromoCodeInput, 'code'>,
): Promise<boolean> => {
  const result = await client.query(
    `UPDATE billing.promo_codes SET
       description = $2, discount_type = $3, discount_value = $4,
       duration_months = $5, valid_from = $6, valid_until = $7,
       max_redemptions = $8, new_customers_only = $9, updated_at = now()
     WHERE id = $1 AND deleted_at IS NULL`,
    [
      promoCodeId,
      input.description,
      input.discountType,
      input.discountValue,
      input.durationMonths,
      input.validFrom,
      input.validUntil,
      input.maxRedemptions,
      input.newCustomersOnly,
    ],
  );
  return (result.rowCount ?? 0) > 0;
};

export const setPromoCodeActive = async (
  client: PoolClient,
  promoCodeId: string,
  active: boolean,
): Promise<boolean> => {
  const result = await client.query(
    `UPDATE billing.promo_codes SET active = $2, updated_at = now()
     WHERE id = $1 AND deleted_at IS NULL`,
    [promoCodeId, active],
  );
  return (result.rowCount ?? 0) > 0;
};

export interface RedemptionRow {
  id: string;
  promo_code_id: string;
  code: string;
  description: string;
  discount_type: DiscountType;
  discount_value: number;
  duration_months: number | null;
  billing_account_id: string;
  account_name: string;
  redeemed_at: Date;
  starts_month: string;
  ends_month: string | null;
}

const REDEMPTION_SELECT = `SELECT r.id, r.promo_code_id, p.code, p.description, p.discount_type,
    p.discount_value, p.duration_months, r.billing_account_id, a.name AS account_name,
    r.redeemed_at, r.starts_month::text AS starts_month, r.ends_month::text AS ends_month
  FROM billing.promo_redemptions r
  JOIN billing.promo_codes p ON p.id = r.promo_code_id
  JOIN billing.billing_accounts a ON a.id = r.billing_account_id`;

export const listRedemptionsForCode = async (
  database: Reader,
  promoCodeId: string,
): Promise<RedemptionRow[]> => {
  const result = await database.query<RedemptionRow>(
    `${REDEMPTION_SELECT}
     WHERE r.promo_code_id = $1 AND r.deleted_at IS NULL
     ORDER BY r.redeemed_at DESC`,
    [promoCodeId],
  );
  return result.rows;
};

// The account's redemptions, newest first.
export const listRedemptionsForAccount = async (
  database: Reader,
  billingAccountId: string,
): Promise<RedemptionRow[]> => {
  const result = await database.query<RedemptionRow>(
    `${REDEMPTION_SELECT}
     WHERE r.billing_account_id = $1 AND r.deleted_at IS NULL
     ORDER BY r.starts_month DESC, r.redeemed_at DESC`,
    [billingAccountId],
  );
  return result.rows;
};

export const insertRedemption = async (
  client: PoolClient,
  params: {
    promoCodeId: string;
    billingAccountId: string;
    redeemedBy: string;
    startsMonth: string;
    endsMonth: string | null;
  },
): Promise<string> => {
  const result = await client.query<{ id: string }>(
    `INSERT INTO billing.promo_redemptions
       (promo_code_id, billing_account_id, redeemed_by, starts_month, ends_month)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [
      params.promoCodeId,
      params.billingAccountId,
      params.redeemedBy,
      params.startsMonth,
      params.endsMonth,
    ],
  );
  await client.query(
    `UPDATE billing.promo_codes SET redemptions_count = redemptions_count + 1,
       updated_at = now() WHERE id = $1`,
    [params.promoCodeId],
  );
  return result.rows[0].id;
};

// A new customer: nothing has been invoiced to them yet (a A$0 free month
// doesn't count). Personal TECH payments are separate accounts.
export const isNewCustomer = async (
  database: Reader,
  billingAccountId: string,
): Promise<boolean> => {
  const result = await database.query<{ invoiced: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM billing.invoices
       WHERE billing_account_id = $1 AND kind <> 'personal'
         AND status IN ('synced', 'paid', 'payment_failed')
         AND total_ex_gst_cents > 0
     ) AS invoiced`,
    [billingAccountId],
  );
  return result.rows[0]?.invoiced !== true;
};
