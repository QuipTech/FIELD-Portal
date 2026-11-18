import { addMonthsToDay, firstDayOfMonth } from '../billingCalendar/billingDay';
import { DiscountType } from './discountRules';

// Pure rules for redeeming a promo code. Each refusal has a stable code the
// portal turns into a clear message.

export const PROMO_ERROR_CODES = [
  'invalid',
  'expired',
  'fully_used',
  'new_customers_only',
  'already_used',
  'promo_already_active',
] as const;

export type PromoErrorCode = (typeof PROMO_ERROR_CODES)[number];

export const PROMO_ERROR_MESSAGES: Record<PromoErrorCode, string> = {
  invalid: "That promo code isn't valid. Check the spelling and try again.",
  expired: 'That promo code has expired.',
  fully_used: 'That promo code has been fully used.',
  new_customers_only: 'That promo code is for new customers only.',
  already_used: 'Your organisation has already used that promo code.',
  promo_already_active:
    'Your organisation already has an active promo code. Only one can apply at a time.',
};

export interface PromoCodeForRedemption {
  active: boolean;
  validFrom: string | null;
  validUntil: string | null;
  maxRedemptions: number | null;
  redemptionsCount: number;
  newCustomersOnly: boolean;
}

// Codes are case-insensitive and stored as typed; compare normalised.
export const normaliseCode = (code: string): string =>
  code.trim().toUpperCase();

// Why a code can't be redeemed today (account-local day), or null if it
// can. Checked in this order so the message is the most useful one: an
// unknown or switched-off code is just invalid, whatever else is true.
export const findRedemptionProblem = (input: {
  code: PromoCodeForRedemption | undefined;
  today: string;
  alreadyRedeemedByAccount: boolean;
  accountHasActivePromo: boolean;
  accountIsNewCustomer: boolean;
}): PromoErrorCode | null => {
  const { code, today } = input;
  if (!code || !code.active) return 'invalid';
  if (code.validFrom !== null && today < code.validFrom) return 'invalid';
  if (code.validUntil !== null && today > code.validUntil) return 'expired';
  if (input.alreadyRedeemedByAccount) return 'already_used';
  if (
    code.maxRedemptions !== null &&
    code.redemptionsCount >= code.maxRedemptions
  )
    return 'fully_used';
  if (code.newCustomersOnly && !input.accountIsNewCustomer)
    return 'new_customers_only';
  if (input.accountHasActivePromo) return 'promo_already_active';
  return null;
};

// A code redeemed today discounts from the month still open (account-local)
// for durationMonths months; null = no end.
export const redemptionMonths = (
  today: string,
  durationMonths: number | null,
): { startsMonth: string; endsMonth: string | null } => {
  const startsMonth = firstDayOfMonth(today);
  return {
    startsMonth,
    endsMonth:
      durationMonths === null
        ? null
        : addMonthsToDay(startsMonth, durationMonths - 1),
  };
};

// A redemption still gives a discount this month or later.
export const isRedemptionCurrent = (
  redemption: { endsMonth: string | null },
  today: string,
): boolean =>
  redemption.endsMonth === null ||
  redemption.endsMonth >= firstDayOfMonth(today);

// What a customer is told the code does, e.g. "20% off machine charges for
// 3 months".
export const describePromo = (promo: {
  discountType: DiscountType;
  discountValue: number;
  durationMonths: number | null;
}): string => {
  const amount =
    promo.discountType === 'percent'
      ? `${promo.discountValue}%`
      : `A$${(promo.discountValue / 100).toFixed(2)}`;
  if (promo.durationMonths === null)
    return `${amount} off machine charges every month`;
  if (promo.durationMonths === 1)
    return `${amount} off machine charges for 1 month`;
  const perMonth = promo.discountType === 'fixed_cents' ? ' a month' : '';
  return `${amount} off machine charges${perMonth} for ${promo.durationMonths} months`;
};
