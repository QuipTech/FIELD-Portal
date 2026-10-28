import { ConflictException, BadRequestException } from '@nestjs/common';
import { AuthenticatedUser } from '../../src/auth/types/authenticatedUser';
import { AllowanceService } from '../../src/billing/allowance/allowance.service';
import { BillingAccountsService } from '../../src/billing/billingAccounts/billingAccounts.service';
import { BillingConfigService } from '../../src/billing/billingConfig/billingConfig.service';
import { BillingNotifier } from '../../src/billing/billingNotices/billingNotifier.service';
import { BillingSettingsService } from '../../src/billing/billingSettings/billingSettings.service';
import { AccountSuspensionService } from '../../src/billing/collections/accountSuspension.service';
import { CreditNotesService } from '../../src/billing/collections/creditNotes.service';
import { OverdueService } from '../../src/billing/collections/overdue.service';
import { OrganisationPlanService } from '../../src/billing/customerBilling/organisationPlan.service';
import { InvoicesService } from '../../src/billing/invoices/invoices.service';
import { UpFrontInvoiceService } from '../../src/billing/invoices/upFrontInvoice.service';
import { OnboardingService } from '../../src/billing/onboarding/onboarding.service';
import { PriceBooksService } from '../../src/billing/priceBooks/priceBooks.service';
import { ReviewTasksService } from '../../src/billing/reviewTasks/reviewTasks.service';
import { AnnualQuoteService } from '../../src/billing/signUp/annualQuote.service';
import { StripeService } from '../../src/billing/stripe/stripe.service';
import { SubscriptionRenewalService } from '../../src/billing/subscriptions/subscriptionRenewal.service';
import { SubscriptionsService } from '../../src/billing/subscriptions/subscriptions.service';
import { AdminInvoicesService } from '../../src/billing/adminInvoices/adminInvoices.service';
import { PersonalPaymentCheckService } from '../../src/billing/personalSubscription/personalPaymentCheck.service';
import { EmailService } from '../../src/email/email.service';
import {
  BillingTestDatabase,
  createBillingTestDatabase,
} from './billingTestDatabase';

// The billing operations services against the real migrated schema, as
// the service role. Stripe and email are faked; every SQL statement runs.
describe('billing operations', () => {
  let fixture: BillingTestDatabase;
  let accountId: string;
  let admin: AuthenticatedUser;
  let platformAdmin: AuthenticatedUser;
  const finaliseInvoice = jest.fn();
  const createCreditNote = jest.fn();

  let config: BillingConfigService;
  let subscriptions: SubscriptionsService;
  let upFront: UpFrontInvoiceService;
  let notifier: BillingNotifier;

  beforeAll(async () => {
    fixture = await createBillingTestDatabase();
    accountId = (
      await fixture.query(
        'SELECT billing_account_id FROM tenants WHERE id = $1',
        [fixture.ids.customerTenant],
      )
    ).rows[0].billing_account_id;
    admin = {
      tenantId: fixture.ids.customerTenant,
      userId: fixture.ids.customerAdmin,
      email: 'admin@pit.test',
    };
    platformAdmin = {
      tenantId: fixture.ids.platformTenant,
      userId: fixture.ids.platformOwner,
      email: 'owner@quiptech.test',
    };
    const db = fixture.serviceDatabase;
    config = new BillingConfigService(db);
    const priceBooks = new PriceBooksService(db);
    subscriptions = new SubscriptionsService(db, config, priceBooks);
    const accounts = new BillingAccountsService(
      fixture.database,
      db,
      {} as StripeService,
      config,
    );
    upFront = new UpFrontInvoiceService(db, accounts, priceBooks, {
      finaliseInvoice,
    } as unknown as InvoicesService);
    notifier = new BillingNotifier(db, { isConfigured: false } as EmailService);
  });
  afterAll(() => fixture.db.close());
  beforeEach(async () => {
    jest.clearAllMocks();
    await fixture.db.exec('BEGIN');
  });
  afterEach(() => fixture.db.exec('ROLLBACK'));

  const liveAssetPro = async () =>
    (
      await fixture.query(
        `SELECT id, term, committed_qty, status, current_period_start::text,
                current_period_end::text, next_term
         FROM billing.subscriptions WHERE billing_account_id = $1 AND plan_code = 'ASSET_PRO'`,
        [accountId],
      )
    ).rows[0];
  const endCurrentTerm = () =>
    fixture.query(
      `UPDATE billing.subscriptions
       SET current_period_start = (date_trunc('month', now()) - interval '1 month')::date,
           current_period_end = date_trunc('month', now())::date
       WHERE billing_account_id = $1 AND plan_code = 'ASSET_PRO'`,
      [accountId],
    );
  const notificationsFor = async (userId: string) =>
    (
      await fixture.query(
        `SELECT title FROM notifications WHERE user_id = $1 AND kind = 'billing' ORDER BY created_at`,
        [userId],
      )
    ).rows.map((row) => row.title);

  describe('plan changes and renewal', () => {
    const plans = () =>
      new OrganisationPlanService(
        fixture.serviceDatabase,
        subscriptions,
        new PriceBooksService(fixture.serviceDatabase),
        new AnnualQuoteService(
          config,
          new PriceBooksService(fixture.serviceDatabase),
        ),
        config,
      );
    const renewals = () =>
      new SubscriptionRenewalService(
        fixture.serviceDatabase,
        subscriptions,
        upFront,
      );

    it('shows the organisation its plan and this month so far', async () => {
      const summary = await plans().getSummary(admin);
      expect(summary.plan).toMatchObject({
        planCode: 'ASSET_PRO',
        planName: 'FIELD Asset Professional',
        term: 'monthly',
      });
      expect(summary.thisMonth).toMatchObject({
        activeToday: 0,
        peakSoFar: 0,
        estimateCents: 0,
      });
      expect(summary.overdue.count).toBe(0);
    });

    it('switches to annual at renewal and invoices the term up front (T13)', async () => {
      await plans().chooseNextTerm(admin, { term: 'annual', committedQty: 15 });
      expect(await liveAssetPro()).toMatchObject({
        term: 'monthly',
        next_term: 'annual',
      });
      await endCurrentTerm();
      expect(await renewals().renewAllAccounts(new Date())).toBeGreaterThan(0);
      expect(await liveAssetPro()).toMatchObject({
        term: 'annual',
        committed_qty: 15,
        next_term: null,
      });
      const invoice = (
        await fixture.query(
          `SELECT i.kind, i.total_ex_gst_cents::int, l.line_type
           FROM billing.invoices i JOIN billing.invoice_lines l ON l.invoice_id = i.id
           WHERE i.billing_account_id = $1 AND i.kind = 'annual'`,
          [accountId],
        )
      ).rows;
      expect(invoice).toEqual([
        {
          kind: 'annual',
          total_ex_gst_cents: 525000,
          line_type: 'ASSET_PRO_ANNUAL',
        },
      ]);
      expect(finaliseInvoice).toHaveBeenCalledTimes(1);
      // Running again never invoices the same term twice.
      await renewals().renewAllAccounts(new Date());
      expect(finaliseInvoice).toHaveBeenCalledTimes(1);
    });

    it('re-pins a monthly plan for the new month', async () => {
      await endCurrentTerm();
      await renewals().renewAllAccounts(new Date());
      const plan = await liveAssetPro();
      expect(plan.term).toBe('monthly');
      expect(plan.current_period_end > plan.current_period_start).toBe(true);
      expect(finaliseInvoice).not.toHaveBeenCalled();
    });

    it('ends a cancelled plan on its date, and lets it be kept before then', async () => {
      await plans().cancel(admin, 'Moving to another system');
      expect((await liveAssetPro()).status).toBe('cancelling');
      await plans().keep(admin);
      expect((await liveAssetPro()).status).toBe('active');
      await plans().cancel(admin, 'Moving to another system');
      await fixture.query(
        `UPDATE billing.subscriptions SET current_period_end = current_date, cancel_at = current_date
         WHERE billing_account_id = $1 AND plan_code = 'ASSET_PRO'`,
        [accountId],
      );
      await renewals().renewAllAccounts(new Date());
      expect((await liveAssetPro()).status).toBe('cancelled');
    });

    it('refuses a next-term change while the plan is ending', async () => {
      await plans().cancel(admin, 'Closing down');
      await expect(
        plans().chooseNextTerm(admin, { term: 'annual', committedQty: 5 }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('overdue accounts and suspension', () => {
    const insertOverdueInvoice = (daysOverdue: number) =>
      fixture.query(
        `INSERT INTO billing.invoices
           (billing_account_id, currency, total_ex_gst_cents, total_cents, status, due_on, kind,
            stripe_invoice_id, hosted_invoice_url)
         VALUES ($1, 'AUD', 4900, 5390, 'synced', current_date - $2::int, 'manual',
                 'in_' || gen_random_uuid(), 'https://invoice.stripe.com/i/x')
         RETURNING id`,
        [accountId, daysOverdue],
      );
    const overdue = () =>
      new OverdueService(fixture.serviceDatabase, config, notifier);
    const suspension = () =>
      new AccountSuspensionService(fixture.serviceDatabase, config, notifier);

    it('sends the day-1 notice once to the billing admins', async () => {
      await insertOverdueInvoice(2);
      expect(await overdue().sendDueNotices(new Date())).toBe(1);
      expect(await overdue().sendDueNotices(new Date())).toBe(0);
      expect(await notificationsFor(fixture.ids.customerAdmin)).toEqual([
        'Invoice overdue',
      ]);
    });

    it('sends the 7-day notice after the first', async () => {
      await insertOverdueInvoice(8);
      await overdue().sendDueNotices(new Date());
      await overdue().sendDueNotices(new Date());
      expect(await notificationsFor(fixture.ids.customerAdmin)).toEqual([
        'Invoice overdue',
        'Invoice 7 days overdue',
      ]);
    });

    it('allows suspension only after the 14-day notice, then pauses new work (T30)', async () => {
      const invoice = await insertOverdueInvoice(20);
      await overdue().sendDueNotices(new Date());
      await expect(
        suspension().suspend(platformAdmin, accountId, 'Unpaid'),
      ).rejects.toThrow('notice period');
      await fixture.query(
        `UPDATE billing.invoices SET overdue_notice_1_at = now() - interval '15 days' WHERE id = $1`,
        [invoice.rows[0].id],
      );
      await suspension().suspend(
        platformAdmin,
        accountId,
        'Unpaid after notice',
      );
      const suspended = await fixture.asRole(
        'field_app',
        { tenantId: fixture.ids.customerTenant },
        async (client) =>
          (
            await client.query(
              'SELECT current_billing_suspended() AS suspended',
            )
          ).rows[0],
      );
      expect(suspended).toEqual({ suspended: true });
      await suspension().unsuspend(platformAdmin, accountId, 'Paid');
      expect(
        (
          await fixture.query(
            'SELECT suspended_at FROM billing.billing_accounts WHERE id = $1',
            [accountId],
          )
        ).rows[0].suspended_at,
      ).toBeNull();
    });

    it('refuses suspension when nothing is overdue', async () => {
      await expect(
        suspension().suspend(platformAdmin, accountId, 'Unpaid'),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('credit notes', () => {
    const service = () =>
      new CreditNotesService(fixture.serviceDatabase, {
        createCreditNote,
      } as unknown as StripeService);
    const insertSynced = async () =>
      (
        await fixture.query(
          `INSERT INTO billing.invoices
             (billing_account_id, currency, total_ex_gst_cents, total_cents, status, stripe_invoice_id)
           VALUES ($1, 'AUD', 4900, 5390, 'paid', 'in_credit_test') RETURNING id`,
          [accountId],
        )
      ).rows[0].id as string;

    it('credits a finalised invoice on Stripe and records it', async () => {
      createCreditNote.mockResolvedValue({ id: 'cn_1' });
      const invoiceId = await insertSynced();
      const note = await service().create(platformAdmin, invoiceId, {
        amountCents: 2000,
        reason: 'Double-counted machine',
      });
      expect(note).toMatchObject({
        status: 'issued',
        stripeCreditNoteId: 'cn_1',
        amountCents: 2000,
      });
      expect(createCreditNote).toHaveBeenCalledWith(
        {
          stripeInvoiceId: 'in_credit_test',
          amountCents: 2000,
          memo: 'Double-counted machine',
        },
        `credit-note:${note.id}:create`,
      );
      const credited = await fixture.query(
        'SELECT amount_credited_cents::int FROM billing.invoices WHERE id = $1',
        [invoiceId],
      );
      expect(credited.rows[0].amount_credited_cents).toBe(2000);
    });

    it('never credits more than the invoice total', async () => {
      createCreditNote.mockResolvedValue({ id: 'cn_2' });
      const invoiceId = await insertSynced();
      await service().create(platformAdmin, invoiceId, {
        amountCents: 5000,
        reason: 'Refund',
      });
      await expect(
        service().create(platformAdmin, invoiceId, {
          amountCents: 500,
          reason: 'Again',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('keeps a note pending when Stripe fails, and retries it with the same key', async () => {
      createCreditNote.mockRejectedValueOnce(new Error('Stripe down'));
      const invoiceId = await insertSynced();
      await expect(
        service().create(platformAdmin, invoiceId, {
          amountCents: 1000,
          reason: 'Goodwill',
        }),
      ).rejects.toThrow('Stripe down');
      const [pending] = await service().list(invoiceId);
      expect(pending.status).toBe('pending');
      createCreditNote.mockResolvedValue({ id: 'cn_3' });
      expect(await service().retry(pending.id)).toMatchObject({
        status: 'issued',
      });
      expect(createCreditNote.mock.calls[1][1]).toBe(
        createCreditNote.mock.calls[0][1],
      );
    });
  });

  describe('assisted onboarding', () => {
    const service = () =>
      new OnboardingService(
        fixture.serviceDatabase,
        new BillingAccountsService(
          fixture.database,
          fixture.serviceDatabase,
          {} as StripeService,
          config,
        ),
        new PriceBooksService(fixture.serviceDatabase),
        upFront,
      );

    it('invoices A$2,500 once when the site is completed', async () => {
      const { id } = await service().schedule(
        platformAdmin,
        accountId,
        'Pit 4',
      );
      const done = await service().complete(platformAdmin, id);
      const lines = await fixture.query(
        `SELECT i.kind, l.line_type, l.amount_cents::int FROM billing.invoices i
         JOIN billing.invoice_lines l ON l.invoice_id = i.id WHERE i.id = $1`,
        [done.invoiceId],
      );
      expect(lines.rows).toEqual([
        {
          kind: 'onboarding',
          line_type: 'ONBOARD_ASSISTED',
          amount_cents: 250000,
        },
      ]);
      await expect(service().complete(platformAdmin, id)).rejects.toThrow(
        'not scheduled',
      );
    });

    it('waives with a reason and invoices nothing', async () => {
      const { id } = await service().schedule(
        platformAdmin,
        accountId,
        'Pit 5',
      );
      await service().waive(
        platformAdmin,
        id,
        'Included in the pilot agreement',
      );
      const [job] = await service().list(accountId);
      expect(job).toMatchObject({ status: 'waived', invoiceId: null });
    });
  });

  describe('fair use', () => {
    const allowance = () =>
      new AllowanceService(
        fixture.serviceDatabase,
        config,
        notifier,
        new ReviewTasksService(),
      );
    const activateMachine = async (from: string) => {
      const machineId = await fixture.insertMachine(fixture.ids.customerTenant);
      await fixture.query(
        `INSERT INTO billing.machine_activations (machine_id, billing_account_id, activated_on)
         VALUES ($1, $2, ${from})`,
        [machineId, accountId],
      );
    };
    const insertTurns = (count: number, when: string) =>
      fixture.query(
        `INSERT INTO app.usage_events (tenant_id, billing_account_id, event_type, occurred_at)
         SELECT $1, $2, 'ai_query', ${when} FROM generate_series(1, $3)`,
        [fixture.ids.customerTenant, accountId, count],
      );
    const period = async (metric: string, start: string) =>
      (
        await fixture.query(
          `SELECT allowance::int, used::int, threshold_state, consecutive_over, closed_at IS NOT NULL AS closed
           FROM billing.allowance_periods
           WHERE billing_account_id = $1 AND metric = $2 AND period_start = ${start}`,
          [accountId, metric],
        )
      ).rows[0];

    it('notifies billing admins at 80% without blocking anything (T25)', async () => {
      await activateMachine(
        "date_trunc('month', now() AT TIME ZONE 'Australia/Brisbane')::date",
      );
      await insertTurns(90, 'now()');
      await allowance().runAllAccounts(new Date());
      expect(
        await period(
          'ai_turns',
          "date_trunc('month', now() AT TIME ZONE 'Australia/Brisbane')::date",
        ),
      ).toMatchObject({
        allowance: 100,
        used: 90,
        threshold_state: 'notified',
      });
      expect(await notificationsFor(fixture.ids.customerAdmin)).toEqual([
        'AI assistant at 90% of allowance',
      ]);
      await allowance().runAllAccounts(new Date());
      expect(await notificationsFor(fixture.ids.customerAdmin)).toHaveLength(1);
    });

    it('flags at 100% and tells QuipTech too', async () => {
      await activateMachine(
        "date_trunc('month', now() AT TIME ZONE 'Australia/Brisbane')::date",
      );
      await insertTurns(120, 'now()');
      await allowance().runAllAccounts(new Date());
      expect(await notificationsFor(fixture.ids.customerAdmin)).toEqual([
        'AI assistant allowance reached',
      ]);
      expect(await notificationsFor(fixture.ids.platformOwner)).toEqual([
        'AI assistant allowance reached',
      ]);
    });

    it('raises one plan review after a second month over 100% (T26)', async () => {
      const lastMonth =
        "(date_trunc('month', now() AT TIME ZONE 'Australia/Brisbane') - interval '1 month')::date";
      const monthBefore =
        "(date_trunc('month', now() AT TIME ZONE 'Australia/Brisbane') - interval '2 months')::date";
      await activateMachine(monthBefore);
      await insertTurns(
        150,
        `(${lastMonth} + interval '3 days')::timestamp AT TIME ZONE 'Australia/Brisbane'`,
      );
      await fixture.query(
        `INSERT INTO billing.allowance_periods
           (billing_account_id, period_start, metric, allowance, used, consecutive_over, closed_at)
         VALUES ($1, ${monthBefore}, 'ai_turns', 100, 130, 1, now())`,
        [accountId],
      );
      await fixture.query(
        `INSERT INTO billing.allowance_periods (billing_account_id, period_start, metric, allowance, used)
         VALUES ($1, ${lastMonth}, 'ai_turns', 100, 0)`,
        [accountId],
      );
      await allowance().runAllAccounts(new Date());
      expect(await period('ai_turns', lastMonth)).toMatchObject({
        used: 150,
        consecutive_over: 2,
        closed: true,
      });
      const tasks = await fixture.query(
        `SELECT type, status FROM billing.review_tasks WHERE billing_account_id = $1`,
        [accountId],
      );
      expect(tasks.rows).toEqual([{ type: 'plan_review', status: 'open' }]);
    });
  });

  describe('platform admin settings', () => {
    const settings = () =>
      new BillingSettingsService(fixture.serviceDatabase, config);

    it('adds a price book version without touching pinned subscriptions (T27)', async () => {
      const pinnedBefore = (await liveAssetPro()).id;
      const created = await settings().createPriceBook(platformAdmin, {
        planCode: 'ASSET_PRO',
        effectiveFrom: '2099-01-01',
        unitCents: null,
        minimumAnnualCents: null,
        bands: [
          { lowerQty: 1, upperQty: 25, unitCents: 3900 },
          { lowerQty: 26, upperQty: 99, unitCents: 3200 },
          { lowerQty: 100, upperQty: null, unitCents: 2700 },
        ],
      });
      expect(created.version).toBe(2);
      const books = await settings().listPriceBooks();
      const assetPro = books.filter((book) => book.planCode === 'ASSET_PRO');
      expect(assetPro.map((book) => [book.version, book.isInEffect])).toEqual([
        [2, false],
        [1, true],
      ]);
      expect(assetPro[1].subscriptionCount).toBeGreaterThan(0);
      expect((await liveAssetPro()).id).toBe(pinnedBefore);
    });

    it('refuses bands with a gap', async () => {
      await expect(
        settings().createPriceBook(platformAdmin, {
          planCode: 'ASSET_PRO',
          effectiveFrom: '2099-01-01',
          unitCents: null,
          minimumAnnualCents: null,
          bands: [
            { lowerQty: 1, upperQty: 25, unitCents: 3900 },
            { lowerQty: 30, upperQty: null, unitCents: 3200 },
          ],
        }),
      ).rejects.toThrow('must start at 26');
    });

    it('edits a setting, validating it against its kind', async () => {
      await settings().updateConfig(
        platformAdmin,
        'AI_ALLOWANCE_PER_ACTIVE_MACHINE',
        250,
      );
      expect((await config.loadConfig()).AI_ALLOWANCE_PER_ACTIVE_MACHINE).toBe(
        250,
      );
      await expect(
        settings().updateConfig(
          platformAdmin,
          'DEFAULT_BILLING_TIMEZONE',
          'Mars/Base',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('lists and resolves review tasks', async () => {
      await fixture.query(
        `INSERT INTO billing.review_tasks (billing_account_id, type, reason) VALUES ($1, 'plan_review', 'Over allowance')`,
        [accountId],
      );
      const [task] = await settings().listReviewTasks('open');
      await settings().updateReviewTask(platformAdmin, task.id, {
        status: 'resolved',
        notes: 'Moved to annual',
      });
      expect(await settings().listReviewTasks('open')).toEqual([]);
      expect((await settings().listReviewTasks('closed'))[0]).toMatchObject({
        status: 'resolved',
        notes: 'Moved to annual',
      });
    });
  });

  it('lists every invoice for the platform admin as the service role', async () => {
    await fixture.query(
      `INSERT INTO billing.invoices (billing_account_id, currency, total_ex_gst_cents, status, kind)
       VALUES ($1, 'AUD', 4900, 'synced', 'manual')`,
      [accountId],
    );
    const list = await new AdminInvoicesService(
      fixture.serviceDatabase,
      {} as PersonalPaymentCheckService,
    ).list({ page: 1, pageSize: 25 });
    expect(list.items[0]).toMatchObject({
      kind: 'organisation',
      category: 'unpaid',
      organisationName: 'Pit Crew',
    });
    expect(list.summary.unpaid.count).toBe(1);
  });

  it('lists organisations with their plan and collection status for the admin', async () => {
    await fixture.query(
      `INSERT INTO billing.invoices (billing_account_id, currency, total_ex_gst_cents, status, due_on, kind)
       VALUES ($1, 'AUD', 4900, 'synced', current_date - 3, 'manual')`,
      [accountId],
    );
    const organisations = await new BillingAccountsService(
      fixture.database,
      fixture.serviceDatabase,
      {} as StripeService,
      config,
    ).listOrganisations();
    const pitCrew = organisations.find(
      (row) => row.organisationName === 'Pit Crew',
    );
    expect(pitCrew).toMatchObject({
      plan: { planCode: 'ASSET_PRO', term: 'monthly', status: 'active' },
      overdueInvoiceCount: 1,
      usageFlagged: false,
    });
  });
});
