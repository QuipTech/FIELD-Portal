import { DatabaseService } from '../../database/database.service';
import { ServiceDatabaseService } from '../../database/serviceDatabase.service';
import { BillingConfigService } from '../billingConfig/billingConfig.service';
import { PriceBooksService } from '../priceBooks/priceBooks.service';
import { PersonalSubscriptionService } from './personalSubscription.service';
import {
  isPersonalPeriodPaid,
  needsReplacementInvoice,
  PersonalPeriodRow,
} from './personalSubscriptionTypes';

const actor = {
  userId: 'user-a',
  tenantId: 'tenant-a',
  email: 'a@example.com',
};
const paidPeriod = (): PersonalPeriodRow => ({
  id: 'period-a',
  invoice_id: 'invoice-a',
  billing_account_id: 'personal-a',
  price_book_id: 'pinned-book',
  period_start: '2026-10-01',
  period_end: '2026-11-01',
  unit_cents: '4900',
  status: 'paid',
  total_cents: '5390',
  gst_cents: '490',
  amount_paid_cents: '5390',
  amount_refunded_cents: '0',
  hosted_invoice_url: 'https://invoice.stripe.com/i/a',
});

const setup = (
  roles: string[],
  periods: PersonalPeriodRow[] = [],
  hasOrganisationSeat = false,
) => {
  const roleClient = {
    query: jest
      .fn()
      .mockResolvedValue({ rows: roles.map((name) => ({ name })) }),
  };
  const tenantDatabase = {
    withTenant: jest.fn(
      async (_id: string, work: (client: typeof roleClient) => unknown) =>
        work(roleClient),
    ),
  };
  const serviceDatabase = {
    query: jest.fn(async (sql: string) => ({
      rows: sql.includes('FROM billing.personal_accounts')
        ? []
        : sql.includes('FROM billing.seats')
          ? [{ covered: hasOrganisationSeat }]
          : periods,
    })),
  };
  const books = {
    getPriceBookInEffect: jest
      .fn()
      .mockResolvedValue({ id: 'new-book', unitCents: 5900 }),
    getPinnedPriceBook: jest
      .fn()
      .mockResolvedValue({ id: 'pinned-book', unitCents: 4900 }),
  };
  const service = new PersonalSubscriptionService(
    tenantDatabase as unknown as DatabaseService,
    serviceDatabase as unknown as ServiceDatabaseService,
    {
      loadConfig: async () => ({
        DEFAULT_BILLING_TIMEZONE: 'Australia/Brisbane',
      }),
    } as BillingConfigService,
    books as unknown as PriceBooksService,
  );
  return { service, serviceDatabase, tenantDatabase, books };
};

describe('personal subscription payment', () => {
  it('exempts the current database Owner role, without consulting personal invoices', async () => {
    const { service, serviceDatabase } = setup(['Owner']);
    expect(await service.getStatus(actor)).toMatchObject({
      exempt: true,
      paymentRequired: false,
    });
    expect(serviceDatabase.query).not.toHaveBeenCalled();
  });

  it.each([
    'Customer',
    'Support Agent',
    'Technician',
    'Supervisor',
    'Partner',
    'Read-only viewer',
  ])(
    'requires payment from %s even without a personal billing record',
    async (role) => {
      const { service } = setup([role]);
      expect(await service.getStatus(actor)).toMatchObject({
        exempt: false,
        paymentRequired: true,
        monthlyCents: 5900,
      });
    },
  );

  it('does not trust a paid organisation subscription or client role', async () => {
    const { service, tenantDatabase } = setup([]);
    expect((await service.getStatus(actor)).paymentRequired).toBe(true);
    expect(tenantDatabase.withTenant).toHaveBeenCalledWith(
      actor.tenantId,
      expect.any(Function),
    );
  });

  it('accepts a paid personal invoice and pins its existing price book (T27)', async () => {
    const { service, books } = setup(['Customer'], [paidPeriod()]);
    const result = await service.getStatus(
      actor,
      new Date('2026-10-20T00:00:00Z'),
    );
    expect(result).toMatchObject({
      paymentRequired: false,
      monthlyCents: 4900,
      totalCents: 5390,
    });
    expect(books.getPinnedPriceBook).toHaveBeenCalledWith('pinned-book');
    expect(books.getPriceBookInEffect).not.toHaveBeenCalled();
  });

  it('starts the new billing month in Brisbane while UTC is still in October', async () => {
    const { service } = setup(['Customer'], [paidPeriod()]);
    const result = await service.getStatus(
      actor,
      new Date('2026-10-31T15:00:00Z'),
    );
    expect(result).toMatchObject({
      periodStart: '2026-11-01',
      periodEnd: '2026-12-01',
      paymentRequired: true,
    });
  });

  it('scopes every personal invoice read to both the authenticated user and tenant', async () => {
    const { service, serviceDatabase } = setup(['Customer'], [paidPeriod()]);
    await service.listInvoices(actor);
    expect(serviceDatabase.query).toHaveBeenCalledWith(
      expect.stringContaining('p.user_id = $1 AND p.tenant_id = $2'),
      [actor.userId, actor.tenantId],
    );
  });

  it('excludes draft invoices and converts bigint strings to integer cents', async () => {
    const { service } = setup(
      ['Customer'],
      [paidPeriod(), { ...paidPeriod(), status: 'draft' }],
    );
    expect(await service.listInvoices(actor)).toEqual([
      expect.objectContaining({
        totalExGstCents: 4900,
        gstCents: 490,
        totalCents: 5390,
      }),
    ]);
  });

  it.each(['draft', 'final', 'synced', 'payment_failed', 'void'] as const)(
    'does not treat a %s invoice or payment link as proof of payment',
    (status) => {
      expect(isPersonalPeriodPaid({ ...paidPeriod(), status })).toBe(false);
    },
  );

  it('requires the recorded paid amount to cover the invoice', () => {
    expect(
      isPersonalPeriodPaid({ ...paidPeriod(), amount_paid_cents: '1' }),
    ).toBe(false);
    expect(isPersonalPeriodPaid({ ...paidPeriod(), total_cents: null })).toBe(
      false,
    );
    expect(isPersonalPeriodPaid(undefined)).toBe(false);
  });

  it('treats a refunded invoice as unpaid', () => {
    expect(
      isPersonalPeriodPaid({ ...paidPeriod(), amount_refunded_cents: '5390' }),
    ).toBe(false);
  });

  it('counts an active TECH seat on the organisation account as this month paid', async () => {
    const { service } = setup(['Customer'], [], true);
    expect(await service.getStatus(actor)).toMatchObject({
      coveredByOrganisation: true,
      paymentRequired: false,
    });
  });

  it('still requires personal payment without an organisation TECH seat', async () => {
    const { service } = setup(['Customer'], [], false);
    expect(await service.getStatus(actor)).toMatchObject({
      coveredByOrganisation: false,
      paymentRequired: true,
    });
  });

  it('never checks seats for an exempt Owner', async () => {
    const { service, serviceDatabase } = setup(['Owner']);
    expect((await service.getStatus(actor)).coveredByOrganisation).toBe(false);
    expect(serviceDatabase.query).not.toHaveBeenCalled();
  });

  it('replaces refunded and void invoices, but not unpaid or failed ones', () => {
    expect(
      needsReplacementInvoice({
        ...paidPeriod(),
        amount_refunded_cents: '5390',
      }),
    ).toBe(true);
    expect(needsReplacementInvoice({ ...paidPeriod(), status: 'void' })).toBe(
      true,
    );
    expect(
      needsReplacementInvoice({ ...paidPeriod(), status: 'payment_failed' }),
    ).toBe(false);
    expect(needsReplacementInvoice({ ...paidPeriod(), status: 'synced' })).toBe(
      false,
    );
  });
});
