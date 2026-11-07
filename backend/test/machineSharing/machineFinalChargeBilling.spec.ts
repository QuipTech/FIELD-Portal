import { BillingAccountsService } from '../../src/billing/billingAccounts/billingAccounts.service';
import { BillingConfigService } from '../../src/billing/billingConfig/billingConfig.service';
import { InvoicesService } from '../../src/billing/invoices/invoices.service';
import { UpFrontInvoiceService } from '../../src/billing/invoices/upFrontInvoice.service';
import { MonthlyRunService } from '../../src/billing/monthlyRun/monthlyRun.service';
import { PriceBooksService } from '../../src/billing/priceBooks/priceBooks.service';
import { StripeService } from '../../src/billing/stripe/stripe.service';
import { AuthenticatedUser } from '../../src/auth/types/authenticatedUser';
import { MachineDeletionService } from '../../src/machineLifecycle/machineDeletion.service';
import {
  BillingTestDatabase,
  createBillingTestDatabase,
} from '../billing/billingTestDatabase';
import { seedSharingWorld, SharingWorld } from './machineSharingFixtures';

// A machine's final charge and the month-end invoice together, with the real
// price book, invoice code and monthly run: the customer pays for the same
// machine's month once. Only Stripe is faked.
describe('a machine final charge and the month-end invoice', () => {
  let fixture: BillingTestDatabase;
  let world: SharingWorld;
  let deletion: MachineDeletionService;
  let run: MonthlyRunService;
  let admin: AuthenticatedUser;
  const finaliseInvoice = jest.fn(async () => undefined);
  const NOV_20 = new Date('2026-11-20T02:00:00Z');
  const DEC_1 = new Date('2026-12-01T02:00:00Z');

  beforeAll(async () => {
    fixture = await createBillingTestDatabase();
    const db = fixture.serviceDatabase;
    const config = new BillingConfigService(db);
    const priceBooks = new PriceBooksService(db);
    const accounts = new BillingAccountsService(
      fixture.database,
      db,
      {} as StripeService,
      config,
    );
    const upFront = new UpFrontInvoiceService(db, accounts, priceBooks, {
      finaliseInvoice,
    } as unknown as InvoicesService);
    deletion = new MachineDeletionService(
      fixture.database,
      db,
      priceBooks,
      upFront,
    );
    run = new MonthlyRunService(db, config, priceBooks);
  });
  afterAll(() => fixture.db.close());

  // Three machines this November, on a monthly plan: two kept all month, and
  // the one being deleted, active 2 to 7 November.
  beforeEach(async () => {
    jest.clearAllMocks();
    await fixture.db.exec('BEGIN');
    world = await seedSharingWorld(fixture);
    admin = {
      tenantId: fixture.ids.setUpTenant,
      userId: fixture.ids.setUpAdmin,
      email: 'admin@old.test',
    };
    const account = fixture.ids.setUpAccount;
    await fixture.query(
      `DELETE FROM billing.subscriptions WHERE billing_account_id = $1 AND plan_code = 'ASSET_PRO'`,
      [account],
    );
    await fixture.query(
      `INSERT INTO billing.subscriptions
         (billing_account_id, plan_code, price_book_id, term, started_at, current_period_start, current_period_end)
       SELECT $1, 'ASSET_PRO', b.id, 'monthly', '2026-01-01', '2026-11-01', '2026-12-01'
       FROM billing.price_books b WHERE b.plan_code = 'ASSET_PRO'
       ORDER BY b.version DESC LIMIT 1`,
      [account],
    );
    await fixture.query(
      `UPDATE machines SET lifecycle_state = 'registered' WHERE id = $1`,
      [world.ownB.id],
    );
    await fixture.query(
      `UPDATE support_cases SET status = 'closed' WHERE machine_id = $1`,
      [world.ownB.id],
    );
    await fixture.query(
      `INSERT INTO billing.machine_activations
         (machine_id, billing_account_id, activated_on, billing_end, deactivation_requested_at)
       VALUES ($1, $2, '2026-11-02', '2026-12-01', '2026-11-07T02:00:00Z')`,
      [world.ownB.id, account],
    );
    for (const serial of ['KEPT-1', 'KEPT-2']) {
      const kept = await fixture.insertMachine(fixture.ids.setUpTenant);
      await fixture.query(
        `UPDATE machines SET serial_number = $2, lifecycle_state = 'active' WHERE id = $1`,
        [kept, serial],
      );
      await fixture.query(
        `INSERT INTO billing.machine_activations (machine_id, billing_account_id, activated_on)
         VALUES ($1, $2, '2026-11-01')`,
        [kept, account],
      );
    }
  });
  afterEach(() => fixture.db.exec('ROLLBACK'));

  const monthlyLine = async () => {
    const invoiceId = await run.runAccount(
      { id: fixture.ids.setUpAccount, timezone: 'Australia/Brisbane' },
      DEC_1,
    );
    expect(invoiceId).not.toBeNull();
    const { rows } = await fixture.query(
      `SELECT line_type, quantity, unit_cents, amount_cents FROM billing.invoice_lines
       WHERE invoice_id = $1 AND line_type = 'ASSET_PRO'`,
      [invoiceId],
    );
    return {
      quantity: Number(rows[0].quantity),
      amountCents: Number(rows[0].amount_cents),
    };
  };

  it('counts all three machines when nothing was paid separately', async () => {
    expect(await monthlyLine()).toEqual({ quantity: 3, amountCents: 10500 });
  });

  it('charges 6 of 30 days now, and bills only the other two at month end', async () => {
    const raised = await deletion.payFinalCharge(admin, world.ownB.id, NOV_20);
    expect(raised.blocker).toBe('unpaid_invoices');
    expect(finaliseInvoice).toHaveBeenCalledTimes(1);

    const { rows } = await fixture.query(
      `SELECT i.kind, i.status, i.total_ex_gst_cents, l.description, l.amount_cents
       FROM billing.machine_final_charges c
       JOIN billing.invoices i ON i.id = c.invoice_id
       JOIN billing.invoice_lines l ON l.invoice_id = i.id
       WHERE c.machine_id = $1`,
      [world.ownB.id],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: 'machine_final', status: 'draft' });
    // A$35.00 × 6 ÷ 30.
    expect(Number(rows[0].amount_cents)).toBe(700);
    expect(rows[0].description).toContain('6 of 30 days at A$35.00 a month');

    expect(await monthlyLine()).toEqual({ quantity: 2, amountCents: 7000 });
  });

  it('counts the machine again if its charge was voided', async () => {
    await deletion.payFinalCharge(admin, world.ownB.id, NOV_20);
    await fixture.query(
      `UPDATE billing.invoices SET status = 'void' WHERE kind = 'machine_final'`,
    );
    expect(await monthlyLine()).toEqual({ quantity: 3, amountCents: 10500 });
  });

  it('lets the machine go once paid, and still bills the month correctly after', async () => {
    await deletion.payFinalCharge(admin, world.ownB.id, NOV_20);
    await fixture.query(
      `UPDATE billing.invoices SET status = 'paid' WHERE kind = 'machine_final'`,
    );
    await deletion.deleteMachine(admin, world.ownB.id, 'Scrapped', NOV_20);
    expect(await monthlyLine()).toEqual({ quantity: 2, amountCents: 7000 });
  });
});
