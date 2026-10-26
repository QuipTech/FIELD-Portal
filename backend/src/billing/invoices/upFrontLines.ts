import { calculateAnnualUpFrontCents } from '../pricing/annualPricing';
import { calculateFleetPriceCents } from '../pricing/fleetPrice';
import { PinnedPriceBook } from '../pricing/pricingTypes';
import { PLAN_CODES } from '../subscriptions/planCodes';
import { CalculatedLine } from '../monthlyRun/monthlyRunTypes';

// Pure: the lines invoiced at the moment they occur (spec section 9), with
// the snapshot that recalculates them to the cent (T31).

interface AnnualTerm {
  subscriptionId: string;
  planCode: string;
  committedQty: number;
  monthsCharged: number;
  periodStart: string;
  periodEnd: string;
}

// ASSET_PRO: price(Q) × months charged; TECH: Q seats × seat price × months
// charged. null for any other plan.
export const calculateAnnualTermLine = (
  term: AnnualTerm,
  book: PinnedPriceBook,
): CalculatedLine | null => {
  const isAssetPro = term.planCode === PLAN_CODES.assetPro;
  if (!isAssetPro && term.planCode !== PLAN_CODES.tech) return null;
  const seatCents = book.unitCents ?? 0;
  const amountCents = isAssetPro
    ? calculateAnnualUpFrontCents(
        book.bands,
        term.committedQty,
        term.monthsCharged,
      )
    : term.committedQty * seatCents * term.monthsCharged;
  const monthlyCents = isAssetPro
    ? calculateFleetPriceCents(book.bands, term.committedQty)
    : term.committedQty * seatCents;
  return {
    lineType: isAssetPro ? 'ASSET_PRO_ANNUAL' : 'TECH_ANNUAL',
    description: isAssetPro
      ? `FIELD Asset Professional, annual prepaid ${term.periodStart} to ${term.periodEnd}: ${term.committedQty} machines × ${term.monthsCharged} months of ${formatAud(monthlyCents)}`
      : `FIELD Technician, annual prepaid ${term.periodStart} to ${term.periodEnd}: ${term.committedQty} seats × ${term.monthsCharged} months`,
    quantity: 1,
    unitCents: amountCents,
    amountCents,
    calcSnapshot: {
      formula: isAssetPro ? 'ASSET_PRO_ANNUAL' : 'TECH_ANNUAL',
      subscriptionId: term.subscriptionId,
      periodStart: term.periodStart,
      periodEnd: term.periodEnd,
      peak: term.committedQty,
      peakDay: null,
      priceBookId: book.id,
      priceBookVersion: book.version,
      bands: book.bands,
      seatCents: book.unitCents,
      committedQty: term.committedQty,
      monthsCharged: term.monthsCharged,
    },
  };
};

// One site's assisted onboarding at the price book's flat price.
export const calculateOnboardingLine = (
  siteName: string,
  completedOn: string,
  book: PinnedPriceBook,
): CalculatedLine => {
  const unitCents = book.unitCents ?? 0;
  return {
    lineType: 'ONBOARD_ASSISTED',
    description: `Assisted onboarding: ${siteName} (completed ${completedOn})`,
    quantity: 1,
    unitCents,
    amountCents: unitCents,
    calcSnapshot: {
      formula: 'ONBOARD_ASSISTED',
      subscriptionId: null,
      periodStart: completedOn,
      periodEnd: completedOn,
      peak: 1,
      peakDay: completedOn,
      priceBookId: book.id,
      priceBookVersion: book.version,
      bands: [],
      seatCents: unitCents,
      committedQty: null,
      monthsCharged: null,
    },
  };
};

const formatAud = (cents: number) =>
  `A$${(cents / 100).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
