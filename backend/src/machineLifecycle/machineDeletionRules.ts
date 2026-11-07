import { firstDayOfMonth } from '../billing/billingCalendar/billingDay';
import { LifecycleState } from './lifecycleTransitions';

// Whether a machine may be deleted. Billing is monthly in arrears on the
// account's peak, so nothing is paid per machine: a machine that was billed is
// settled once its last billed month has been invoiced and every invoice from
// its first billed month to its last is paid. Pure, so the rule is testable.

export type MachineDeletionBlocker =
  | 'needs_deactivation'
  | 'sold'
  | 'open_cases'
  | 'pending_transfer'
  | 'awaiting_final_invoice'
  | 'unpaid_invoices';

export interface DeletionInvoice {
  id: string;
  periodStart: string;
  status: string;
  totalExGstCents: number;
  hostedInvoiceUrl: string | null;
}

export interface DeletionFacts {
  state: LifecycleState;
  today: string;
  openCaseCount: number;
  hasPendingTransfer: boolean;
  // This billing account's intervals; none if the machine was never billed.
  intervals: { activatedOn: string; billingEnd: string | null }[];
  // Monthly invoices between its first and last billed month, none void.
  invoices: DeletionInvoice[];
  // The run has processed the day after the last billed month, so a month
  // with no invoice had nothing to bill (Enterprise, internal, within an
  // annual commitment).
  runPassedFinalMonth: boolean;
}

export interface MachineDeletionCheck {
  canDelete: boolean;
  blocker: MachineDeletionBlocker | null;
  message: string | null;
  // First day the final invoice can exist, when waiting for it.
  finalInvoiceFrom: string | null;
  unpaidInvoices: {
    id: string;
    periodStart: string;
    status: string;
    hostedInvoiceUrl: string | null;
  }[];
}

const blocked = (
  blocker: MachineDeletionBlocker,
  message: string,
  details: Partial<MachineDeletionCheck> = {},
): MachineDeletionCheck => ({
  canDelete: false,
  blocker,
  message,
  finalInvoiceFrom: null,
  unpaidInvoices: [],
  ...details,
});

const ALLOWED: MachineDeletionCheck = {
  canDelete: true,
  blocker: null,
  message: null,
  finalInvoiceFrom: null,
  unpaidInvoices: [],
};

const previousMonthStart = (day: string): string => {
  const [year, month] = day.split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 2, 1));
  return start.toISOString().slice(0, 10);
};

// The months to check, from the machine's closed intervals; null if it was
// never billed.
export const billedMonthRange = (
  intervals: DeletionFacts['intervals'],
): { firstMonth: string; lastMonth: string; billingEnd: string } | null => {
  const ends = intervals
    .map((interval) => interval.billingEnd)
    .filter((end): end is string => end !== null);
  if (intervals.length === 0 || ends.length === 0) return null;
  const billingEnd = ends.reduce((a, b) => (a > b ? a : b));
  const firstActivated = intervals
    .map((interval) => interval.activatedOn)
    .reduce((a, b) => (a < b ? a : b));
  return {
    firstMonth: firstDayOfMonth(firstActivated),
    lastMonth: previousMonthStart(billingEnd),
    billingEnd,
  };
};

export const assessMachineDeletion = (
  facts: DeletionFacts,
): MachineDeletionCheck => {
  if (facts.state === 'active') {
    return blocked(
      'needs_deactivation',
      'Deactivate this machine first. It can be deleted once its final invoice is paid.',
    );
  }
  if (facts.state === 'sold') {
    return blocked(
      'sold',
      'This machine was sold or transferred, so it stays on record.',
    );
  }
  if (facts.hasPendingTransfer) {
    return blocked(
      'pending_transfer',
      'This machine has a transfer waiting for approval. Cancel it first.',
    );
  }
  if (facts.openCaseCount > 0) {
    return blocked(
      'open_cases',
      'Close the open support cases on this machine first.',
    );
  }
  const range = billedMonthRange(facts.intervals);
  if (!range) return ALLOWED;

  if (facts.today < range.billingEnd) {
    return blocked(
      'awaiting_final_invoice',
      'This machine is still billed for this month. It can be deleted once the final invoice is issued and paid.',
      { finalInvoiceFrom: range.billingEnd },
    );
  }
  const unpaid = facts.invoices.filter(
    (invoice) =>
      invoice.status !== 'paid' &&
      invoice.status !== 'void' &&
      invoice.totalExGstCents > 0,
  );
  if (unpaid.length > 0) {
    return blocked(
      'unpaid_invoices',
      'Pay the invoices below to delete this machine.',
      {
        unpaidInvoices: unpaid.map((invoice) => ({
          id: invoice.id,
          periodStart: invoice.periodStart,
          status: invoice.status,
          hostedInvoiceUrl: invoice.hostedInvoiceUrl,
        })),
      },
    );
  }
  const hasFinalInvoice = facts.invoices.some(
    (invoice) => invoice.periodStart === range.lastMonth,
  );
  if (!hasFinalInvoice && !facts.runPassedFinalMonth) {
    return blocked(
      'awaiting_final_invoice',
      "This machine's final invoice hasn't been issued yet. It can be deleted once that invoice is paid.",
      { finalInvoiceFrom: range.billingEnd },
    );
  }
  return ALLOWED;
};
