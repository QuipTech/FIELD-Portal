// Pure rules for 30-day account statements: totals, references, due dates,
// overdue, and the month-end report row. Amounts are AUD cents.
import { addDaysToDay } from '../billingCalendar/billingDay';
import { PriceBand } from '../pricing/pricingTypes';
import { daysBetween } from '../collections/overdueRules';

export type StatementStatus =
  'draft' | 'ready' | 'invoiced_external' | 'paid' | 'void';

export const STATEMENT_STATUSES: StatementStatus[] = [
  'draft',
  'ready',
  'invoiced_external',
  'paid',
  'void',
];

export const DISCOUNT_LINE_TYPES = ['FREE_PERIOD_DISCOUNT', 'PROMO_DISCOUNT'];
const MACHINE_CHARGE_LINE_TYPES = [
  'ASSET_PRO',
  'ASSET_PRO_OVER_COMMIT',
  'ASSET_PRO_FINAL_DAYS',
  'ASSET_PRO_ANNUAL',
];

// Australian GST, 10%, on the whole statement (rounded half-up). Zoho works
// it out again on import; this is the figure the report shows.
export const GST_RATE_PERCENT = 10;
export const GST_TAX_NAME = 'GST 10%';

export const calculateGstCents = (subtotalExGstCents: number): number =>
  Math.round((subtotalExGstCents * GST_RATE_PERCENT) / 100);

export interface StatementTotals {
  subtotalExGstCents: number;
  gstCents: number;
  totalIncGstCents: number;
}

// Discounts never take a statement below A$0.
export const calculateStatementTotals = (
  lines: { amountCents: number }[],
): StatementTotals => {
  const subtotalExGstCents = Math.max(
    0,
    lines.reduce((sum, line) => sum + line.amountCents, 0),
  );
  const gstCents = calculateGstCents(subtotalExGstCents);
  return {
    subtotalExGstCents,
    gstCents,
    totalIncGstCents: subtotalExGstCents + gstCents,
  };
};

// FLD-2026-11-0042: unique per statement, and the Invoice Number in the
// Zoho import so its lines are grouped into one invoice.
export const formatStatementReference = (
  periodStart: string,
  sequence: number,
): string =>
  `FLD-${periodStart.slice(0, 7)}-${String(sequence).padStart(4, '0')}`;

export const calculateDueOn = (invoiceDate: string, termsDays: number) =>
  addDaysToDay(invoiceDate, termsDays);

// Days past the due date (0 or less: not overdue). Only an invoiced,
// unpaid statement can be overdue.
export const daysOverdue = (
  statement: { status: StatementStatus; dueOn: string | null },
  today: string,
): number | null =>
  statement.status === 'invoiced_external' && statement.dueOn
    ? daysBetween(statement.dueOn, today)
    : null;

export const isOverdue = (
  statement: { status: StatementStatus; dueOn: string | null },
  today: string,
): boolean => (daysOverdue(statement, today) ?? 0) > 0;

// What each status can move to. A ready statement is locked: it only
// leaves through the Zoho number (or void).
export const canSetZohoInvoice = (status: StatementStatus) =>
  status === 'ready' || status === 'invoiced_external';
export const canMarkPaid = (status: StatementStatus) =>
  status === 'invoiced_external';
export const canVoid = (status: StatementStatus) =>
  status !== 'void' && status !== 'paid';

export interface StatementLine {
  lineType: string;
  description: string;
  quantity: number;
  unitCents: number;
  amountCents: number;
  calcSnapshot: {
    peak?: number;
    bands?: PriceBand[];
  } & Record<string, unknown>;
}

export interface ReportFigures {
  peakActiveMachines: number | null;
  rateBand: string | null;
  unitPriceCents: number | null;
  machineChargeCents: number;
  freePeriodDiscountCents: number;
  promoDiscountCents: number;
  otherChargesCents: number;
}

const describeBand = (bands: PriceBand[], peak: number): string | null => {
  const band = bands.find(
    (item) =>
      peak >= item.lowerQty &&
      (item.upperQty === null || peak <= item.upperQty),
  );
  if (!band) return null;
  return band.upperQty === null
    ? `${band.lowerQty}+`
    : `${band.lowerQty}–${band.upperQty}`;
};

// The month-end report's figures from a statement's lines. Discounts are
// negative, as on the statement.
type SummaryLine = Pick<
  StatementLine,
  'lineType' | 'unitCents' | 'amountCents'
> & {
  calcSnapshot: { peak?: number; bands?: PriceBand[] };
};

export const summariseStatementLines = (
  lines: SummaryLine[],
): ReportFigures => {
  const assetPro = lines.find((line) => line.lineType === 'ASSET_PRO');
  const sumOf = (filter: (line: SummaryLine) => boolean) =>
    lines.filter(filter).reduce((sum, line) => sum + line.amountCents, 0);
  const peak = assetPro?.calcSnapshot.peak ?? null;
  return {
    peakActiveMachines: peak,
    rateBand:
      assetPro && peak !== null
        ? describeBand(assetPro.calcSnapshot.bands ?? [], peak)
        : null,
    unitPriceCents: assetPro ? assetPro.unitCents : null,
    machineChargeCents: sumOf((line) =>
      MACHINE_CHARGE_LINE_TYPES.includes(line.lineType),
    ),
    freePeriodDiscountCents: sumOf(
      (line) => line.lineType === 'FREE_PERIOD_DISCOUNT',
    ),
    promoDiscountCents: sumOf((line) => line.lineType === 'PROMO_DISCOUNT'),
    otherChargesCents: sumOf(
      (line) =>
        !MACHINE_CHARGE_LINE_TYPES.includes(line.lineType) &&
        !DISCOUNT_LINE_TYPES.includes(line.lineType),
    ),
  };
};

// Days a machine was active in [periodStart, periodEnd): each activation
// interval [activatedOn, billingEnd) clipped to the month, a day counted once.
export const countActiveDays = (
  intervals: { activatedOn: string; billingEnd: string | null }[],
  periodStart: string,
  periodEnd: string,
): number => {
  const days = new Set<string>();
  for (const interval of intervals) {
    let day =
      interval.activatedOn > periodStart ? interval.activatedOn : periodStart;
    const end =
      interval.billingEnd && interval.billingEnd < periodEnd
        ? interval.billingEnd
        : periodEnd;
    while (day < end) {
      days.add(day);
      day = addDaysToDay(day, 1);
    }
  }
  return days.size;
};
