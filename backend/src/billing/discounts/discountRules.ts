import { divideRoundHalfUp } from '../pricing/roundHalfUp';
import {
  CalculatedLine,
  LineCalcSnapshot,
} from '../monthlyRun/monthlyRunTypes';

// Discounts on a month's invoice (pure). One order, always: the free
// period first, then the promo on what is left. Both apply to machine
// charges only and never take the invoice below A$0. Each becomes a
// negative line (quantity 1) whose snapshot is enough to recalculate it.

export const FREE_PERIOD_LINE_TYPE = 'FREE_PERIOD_DISCOUNT';
export const PROMO_LINE_TYPE = 'PROMO_DISCOUNT';
export const DISCOUNT_LINE_TYPES = [FREE_PERIOD_LINE_TYPE, PROMO_LINE_TYPE];

// Machine charges: what a free period and a promo discount.
// Machine charges, which free periods and promos discount: the monthly
// fleet charge and a deleted machine's final days.
export const MACHINE_LINE_TYPES = [
  'ASSET_PRO',
  'ASSET_PRO_OVER_COMMIT',
  'ASSET_PRO_FINAL_DAYS',
];

export type DiscountType = 'percent' | 'fixed_cents';

export interface FreePeriodTerms {
  // The last day of the free period; its month is the last free month.
  freeUntil: string;
  percent: number;
}

export interface PromoTerms {
  redemptionId: string;
  promoCodeId: string;
  code: string;
  discountType: DiscountType;
  discountValue: number;
  // First days of the first and last discounted months; null = no end.
  startsMonth: string;
  endsMonth: string | null;
}

// A month is free while the free period reaches into it, so the month
// containing free_until is free and billing starts the month after.
export const isFreePeriodActiveForMonth = (
  freeUntil: string | null,
  periodStart: string,
): boolean => freeUntil !== null && freeUntil >= periodStart;

export const isPromoActiveForMonth = (
  promo: Pick<PromoTerms, 'startsMonth' | 'endsMonth'>,
  periodStart: string,
): boolean =>
  promo.startsMonth <= periodStart &&
  (promo.endsMonth === null || periodStart <= promo.endsMonth);

export const percentOfCents = (baseCents: number, percent: number): number =>
  divideRoundHalfUp(baseCents * percent, 100);

// The (negative) amount of a free period line on `baseCents` of machine
// charges.
export const freePeriodDiscountCents = (
  baseCents: number,
  percent: number,
): number => -Math.min(baseCents, percentOfCents(baseCents, percent));

// The (negative) amount of a promo line on what's left after the free
// period. A fixed amount is capped at what's left.
export const promoDiscountCents = (
  baseCents: number,
  discountType: DiscountType,
  discountValue: number,
): number =>
  -Math.min(
    baseCents,
    discountType === 'percent'
      ? percentOfCents(baseCents, discountValue)
      : discountValue,
  );

const sumMachineCents = (lines: CalculatedLine[]): number =>
  lines
    .filter((line) => MACHINE_LINE_TYPES.includes(line.lineType))
    .reduce((sum, line) => sum + line.amountCents, 0);

const describeMonth = (periodStart: string) => `month from ${periodStart}`;

const discountLine = (
  lineType: string,
  description: string,
  amountCents: number,
  snapshot: LineCalcSnapshot,
): CalculatedLine => ({
  lineType,
  description,
  quantity: 1,
  unitCents: amountCents,
  amountCents,
  calcSnapshot: snapshot,
});

// The discount lines for one month's calculated lines (none when nothing
// applies or there are no machine charges). Zero-amount lines are left out.
export const calculateDiscountLines = (input: {
  periodStart: string;
  lines: CalculatedLine[];
  freePeriod: FreePeriodTerms | null;
  promo: PromoTerms | null;
}): CalculatedLine[] => {
  const machineLines = input.lines.filter((line) =>
    MACHINE_LINE_TYPES.includes(line.lineType),
  );
  if (!machineLines.length) return [];
  // Discount lines share the machine charge's pricing context, so the
  // snapshot stays self-contained.
  const context = machineLines[0].calcSnapshot;
  let remaining = sumMachineCents(machineLines);
  const discounts: CalculatedLine[] = [];

  const freePeriod = input.freePeriod;
  if (
    freePeriod &&
    remaining > 0 &&
    isFreePeriodActiveForMonth(freePeriod.freeUntil, input.periodStart)
  ) {
    const amountCents = freePeriodDiscountCents(remaining, freePeriod.percent);
    if (amountCents < 0) {
      discounts.push(
        discountLine(
          FREE_PERIOD_LINE_TYPE,
          `Free period (${freePeriod.percent}% off machines until ${freePeriod.freeUntil}), ${describeMonth(input.periodStart)}`,
          amountCents,
          {
            ...context,
            formula: 'FREE_PERIOD_DISCOUNT',
            discountBaseCents: remaining,
            discountPercent: freePeriod.percent,
            freeUntil: freePeriod.freeUntil,
          },
        ),
      );
      remaining += amountCents;
    }
  }

  const promo = input.promo;
  if (
    promo &&
    remaining > 0 &&
    isPromoActiveForMonth(promo, input.periodStart)
  ) {
    const amountCents = promoDiscountCents(
      remaining,
      promo.discountType,
      promo.discountValue,
    );
    if (amountCents < 0) {
      const what =
        promo.discountType === 'percent'
          ? `${promo.discountValue}% off machines`
          : 'off machines';
      discounts.push(
        discountLine(
          PROMO_LINE_TYPE,
          `Promo code ${promo.code} (${what}), ${describeMonth(input.periodStart)}`,
          amountCents,
          {
            ...context,
            formula: 'PROMO_DISCOUNT',
            discountBaseCents: remaining,
            discountPercent:
              promo.discountType === 'percent'
                ? promo.discountValue
                : undefined,
            discountFixedCents:
              promo.discountType === 'fixed_cents'
                ? promo.discountValue
                : undefined,
            promoCodeId: promo.promoCodeId,
            promoCode: promo.code,
            promoRedemptionId: promo.redemptionId,
          },
        ),
      );
    }
  }
  return discounts;
};

// A discount line's amount from its snapshot alone (T31).
export const recalculateDiscountCents = (
  snapshot: LineCalcSnapshot,
): number => {
  const base = snapshot.discountBaseCents ?? 0;
  if (snapshot.formula === 'FREE_PERIOD_DISCOUNT')
    return freePeriodDiscountCents(base, snapshot.discountPercent ?? 0);
  return snapshot.discountFixedCents !== undefined
    ? promoDiscountCents(base, 'fixed_cents', snapshot.discountFixedCents)
    : promoDiscountCents(base, 'percent', snapshot.discountPercent ?? 0);
};
