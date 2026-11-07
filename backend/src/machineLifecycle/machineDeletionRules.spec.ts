import {
  assessMachineDeletion,
  DeletionFacts,
  DeletionInvoice,
  quoteFinalCharge,
} from './machineDeletionRules';

const facts = (overrides: Partial<DeletionFacts> = {}): DeletionFacts => ({
  state: 'registered',
  today: '2026-11-20',
  openCaseCount: 0,
  hasPendingTransfer: false,
  plan: 'monthly',
  intervals: [],
  invoices: [],
  runPassedLastClosedMonth: false,
  ...overrides,
});
// Active from 25 Oct, deactivated 7 Nov; still billed until 1 Dec.
const billed = {
  intervals: [
    {
      activatedOn: '2026-10-25',
      billingEnd: '2026-12-01',
      lastUsedOn: '2026-11-07',
    },
  ],
};
const invoice = (
  periodStart: string,
  status: string,
  overrides: Partial<DeletionInvoice> = {},
): DeletionInvoice => ({
  id: periodStart,
  periodStart,
  status,
  totalExGstCents: 1000,
  hostedInvoiceUrl: null,
  isFinalCharge: false,
  ...overrides,
});
const octoberPaid = invoice('2026-10-01', 'paid');
const finalCharge = (status: string) =>
  invoice('2026-11-01', status, { id: 'final', isFinalCharge: true });

describe('assessMachineDeletion', () => {
  it('allows a machine that was never billed', () => {
    expect(assessMachineDeletion(facts()).canDelete).toBe(true);
  });

  it('asks an active machine to deactivate first', () => {
    expect(assessMachineDeletion(facts({ state: 'active' })).blocker).toBe(
      'needs_deactivation',
    );
  });

  it('keeps a sold machine on record', () => {
    expect(assessMachineDeletion(facts({ state: 'sold' })).blocker).toBe(
      'sold',
    );
  });

  it('blocks on open cases and pending transfers', () => {
    expect(assessMachineDeletion(facts({ openCaseCount: 1 })).blocker).toBe(
      'open_cases',
    );
    expect(
      assessMachineDeletion(facts({ hasPendingTransfer: true })).blocker,
    ).toBe('pending_transfer');
  });

  it('asks for an unpaid earlier invoice before anything else, even mid-month', () => {
    const check = assessMachineDeletion(
      facts({ ...billed, invoices: [invoice('2026-10-01', 'synced')] }),
    );
    expect(check.blocker).toBe('unpaid_invoices');
    expect(check.unpaidInvoices.map((item) => item.periodStart)).toEqual([
      '2026-10-01',
    ]);
  });

  it("waits when last month's invoice hasn't been issued", () => {
    const check = assessMachineDeletion(facts(billed));
    expect(check.blocker).toBe('awaiting_final_invoice');
    expect(check.finalInvoiceFrom).toBe('2026-11-01');
  });

  it('treats a closed month with nothing to bill as settled once the run passed it', () => {
    expect(
      assessMachineDeletion(
        facts({ ...billed, runPassedLastClosedMonth: true }),
      ).blocker,
    ).toBe('final_charge_due');
  });

  it('asks a monthly plan to pay for the days used this month', () => {
    expect(
      assessMachineDeletion(facts({ ...billed, invoices: [octoberPaid] }))
        .blocker,
    ).toBe('final_charge_due');
  });

  it('skips last month for a machine first activated this month', () => {
    expect(
      assessMachineDeletion(
        facts({
          intervals: [
            {
              activatedOn: '2026-11-05',
              billingEnd: '2026-12-01',
              lastUsedOn: '2026-11-07',
            },
          ],
        }),
      ).blocker,
    ).toBe('final_charge_due');
  });

  it('lists an unpaid final charge until it is paid, then allows', () => {
    const unpaid = assessMachineDeletion(
      facts({ ...billed, invoices: [octoberPaid, finalCharge('synced')] }),
    );
    expect(unpaid.blocker).toBe('unpaid_invoices');
    expect(unpaid.unpaidInvoices[0].isFinalCharge).toBe(true);
    expect(
      assessMachineDeletion(
        facts({ ...billed, invoices: [octoberPaid, finalCharge('paid')] }),
      ).canDelete,
    ).toBe(true);
  });

  it('makes an annual plan wait for the month-end run', () => {
    const check = assessMachineDeletion(
      facts({ ...billed, plan: 'annual', invoices: [octoberPaid] }),
    );
    expect(check.blocker).toBe('awaiting_final_invoice');
    expect(check.finalInvoiceFrom).toBe('2026-12-01');
  });

  it('charges nothing on a plan without a machine charge', () => {
    expect(
      assessMachineDeletion(
        facts({ ...billed, plan: 'none', invoices: [octoberPaid] }),
      ).canDelete,
    ).toBe(true);
  });

  describe('once the billed month has closed', () => {
    const closed = { ...billed, today: '2026-12-10' };

    it('needs its monthly invoices paid', () => {
      expect(
        assessMachineDeletion(
          facts({
            ...closed,
            invoices: [octoberPaid, invoice('2026-11-01', 'payment_failed')],
          }),
        ).blocker,
      ).toBe('unpaid_invoices');
      expect(
        assessMachineDeletion(
          facts({
            ...closed,
            invoices: [octoberPaid, invoice('2026-11-01', 'paid')],
          }),
        ).canDelete,
      ).toBe(true);
    });

    it("doesn't wait on a zero invoice being paid", () => {
      expect(
        assessMachineDeletion(
          facts({
            ...closed,
            invoices: [invoice('2026-11-01', 'final', { totalExGstCents: 0 })],
          }),
        ).canDelete,
      ).toBe(true);
    });

    it("waits when the run hasn't issued its final invoice", () => {
      expect(
        assessMachineDeletion(facts({ ...closed, invoices: [octoberPaid] }))
          .blocker,
      ).toBe('awaiting_final_invoice');
    });
  });
});

describe('quoteFinalCharge', () => {
  it('charges the days from the 1st to the day it was deactivated, both counted', () => {
    expect(quoteFinalCharge(billed.intervals, '2026-11-20', 3500)).toEqual({
      periodStart: '2026-11-01',
      lastUsedOn: '2026-11-07',
      daysUsed: 7,
      daysInMonth: 30,
      monthlyRateCents: 3500,
      amountCents: 817,
    });
  });

  it('starts at the activation day when that is this month', () => {
    const quote = quoteFinalCharge(
      [
        {
          activatedOn: '2026-11-05',
          billingEnd: '2026-12-01',
          lastUsedOn: '2026-11-07',
        },
      ],
      '2026-11-20',
      3000,
    );
    expect(quote.daysUsed).toBe(3);
    expect(quote.amountCents).toBe(300);
  });

  it('counts a day once across intervals, and leaves out the gap', () => {
    const quote = quoteFinalCharge(
      [
        {
          activatedOn: '2026-11-02',
          billingEnd: '2026-12-01',
          lastUsedOn: '2026-11-03',
        },
        {
          activatedOn: '2026-11-03',
          billingEnd: '2026-12-01',
          lastUsedOn: '2026-11-04',
        },
        {
          activatedOn: '2026-11-10',
          billingEnd: '2026-12-01',
          lastUsedOn: '2026-11-10',
        },
      ],
      '2026-11-20',
      3000,
    );
    expect(quote.daysUsed).toBe(4);
    expect(quote.lastUsedOn).toBe('2026-11-10');
  });

  it("ignores an earlier month and uses each month's own length", () => {
    const quote = quoteFinalCharge(
      [
        {
          activatedOn: '2026-01-01',
          billingEnd: '2026-02-01',
          lastUsedOn: '2026-01-20',
        },
        {
          activatedOn: '2027-02-01',
          billingEnd: '2027-03-01',
          lastUsedOn: '2027-02-14',
        },
      ],
      '2027-02-20',
      2800,
    );
    expect(quote.daysInMonth).toBe(28);
    expect(quote.daysUsed).toBe(14);
    expect(quote.amountCents).toBe(1400);
  });

  it('charges the whole of a month used in full at exactly the monthly rate', () => {
    const quote = quoteFinalCharge(
      [
        {
          activatedOn: '2026-10-01',
          billingEnd: '2026-12-01',
          lastUsedOn: '2026-11-30',
        },
      ],
      '2026-11-30',
      3500,
    );
    expect(quote.daysUsed).toBe(30);
    expect(quote.amountCents).toBe(3500);
  });
});
