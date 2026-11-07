import { assessMachineDeletion, DeletionFacts } from './machineDeletionRules';

const facts = (overrides: Partial<DeletionFacts> = {}): DeletionFacts => ({
  state: 'registered',
  today: '2026-12-10',
  openCaseCount: 0,
  hasPendingTransfer: false,
  intervals: [],
  invoices: [],
  runPassedFinalMonth: false,
  ...overrides,
});
const billed = {
  intervals: [{ activatedOn: '2026-10-15', billingEnd: '2026-12-01' }],
};
const invoice = (periodStart: string, status: string, total = 1000) => ({
  id: periodStart,
  periodStart,
  status,
  totalExGstCents: total,
  hostedInvoiceUrl: null,
});

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

  it('waits while the machine is still being billed this month', () => {
    const check = assessMachineDeletion(
      facts({ ...billed, today: '2026-11-20' }),
    );
    expect(check.blocker).toBe('awaiting_final_invoice');
    expect(check.finalInvoiceFrom).toBe('2026-12-01');
  });

  it('waits for the run when the closed month has no invoice yet', () => {
    expect(
      assessMachineDeletion(
        facts({
          ...billed,
          today: '2026-12-01',
          invoices: [invoice('2026-10-01', 'paid')],
        }),
      ).blocker,
    ).toBe('awaiting_final_invoice');
  });

  it('lists every unpaid invoice, including earlier months and held drafts', () => {
    const check = assessMachineDeletion(
      facts({
        ...billed,
        invoices: [
          invoice('2026-10-01', 'payment_failed'),
          invoice('2026-11-01', 'draft'),
        ],
      }),
    );
    expect(check.blocker).toBe('unpaid_invoices');
    expect(check.unpaidInvoices.map((item) => item.periodStart)).toEqual([
      '2026-10-01',
      '2026-11-01',
    ]);
  });

  it('allows once the final invoice and earlier ones are paid', () => {
    expect(
      assessMachineDeletion(
        facts({
          ...billed,
          invoices: [
            invoice('2026-10-01', 'paid'),
            invoice('2026-11-01', 'paid'),
          ],
        }),
      ).canDelete,
    ).toBe(true);
  });

  it('allows a month with nothing to bill once the run has passed it', () => {
    expect(
      assessMachineDeletion(facts({ ...billed, runPassedFinalMonth: true }))
        .canDelete,
    ).toBe(true);
  });

  it("doesn't wait on a zero invoice being paid", () => {
    expect(
      assessMachineDeletion(
        facts({ ...billed, invoices: [invoice('2026-11-01', 'final', 0)] }),
      ).canDelete,
    ).toBe(true);
  });

  it('looks across every interval of a machine reactivated later', () => {
    const check = assessMachineDeletion(
      facts({
        intervals: [
          { activatedOn: '2026-01-10', billingEnd: '2026-03-01' },
          { activatedOn: '2026-10-15', billingEnd: '2027-01-01' },
        ],
      }),
    );
    expect(check.blocker).toBe('awaiting_final_invoice');
    expect(check.finalInvoiceFrom).toBe('2027-01-01');
  });
});
