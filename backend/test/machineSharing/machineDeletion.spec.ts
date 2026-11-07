import { MachineDeletionService } from '../../src/machineLifecycle/machineDeletion.service';
import { PriceBooksService } from '../../src/billing/priceBooks/priceBooks.service';
import { ASSET_PRO_V1 } from '../../src/billing/pricing/priceBookV1Fixture';
import { UpFrontInvoiceService } from '../../src/billing/invoices/upFrontInvoice.service';
import { ListMachinesQueryDto } from '../../src/machineFleet/dto/listMachinesQueryDto';
import { AuthenticatedUser } from '../../src/auth/types/authenticatedUser';
import { listFinalChargedIntervals } from '../../src/billing/monthlyRun/runInvoices.repository';
import * as deletionRepository from '../../src/machineLifecycle/machineDeletion.repository';
import { hasLiveFinalCharge } from '../../src/machineLifecycle/machineDeletion.repository';
import {
  BillingTestDatabase,
  createBillingTestDatabase,
} from '../billing/billingTestDatabase';
import {
  actorsOf,
  seedSharingWorld,
  servicesOf,
  SharingWorld,
} from './machineSharingFixtures';

const NOW = new Date('2026-12-10T02:00:00Z');

// Deleting a machine over the real schema and RLS: what the owner sees, what
// the billing check reads as the tenant role, and what the delete leaves behind.
describe('deleting a machine', () => {
  let fixture: BillingTestDatabase;
  let world: SharingWorld;
  let services: ReturnType<typeof servicesOf>;
  let actors: ReturnType<typeof actorsOf>;
  let deletion: MachineDeletionService;
  let adminB: AuthenticatedUser;
  const finalise = jest.fn(async () => undefined);

  beforeAll(async () => {
    fixture = await createBillingTestDatabase();
    services = servicesOf(fixture);
    const upFront = {
      draft: jest.fn(
        async (
          client,
          _actor,
          params: {
            billingAccountId: string;
            periodStart: string;
            lines: { amountCents: number }[];
          },
        ) => {
          const invoice = await client.query(
            `INSERT INTO billing.invoices (billing_account_id, currency, total_ex_gst_cents, kind, period_start, period_end, status)
             VALUES ($1, 'AUD', $2, 'machine_final', $3::date, ($3::date + interval '1 month')::date, 'draft') RETURNING id`,
            [
              params.billingAccountId,
              params.lines.reduce((sum, line) => sum + line.amountCents, 0),
              params.periodStart,
            ],
          );
          return invoice.rows[0].id;
        },
      ),
      finalise,
    } as unknown as UpFrontInvoiceService;
    const priceBooks = {
      getPinnedPriceBook: jest.fn(async () => ASSET_PRO_V1),
    } as unknown as PriceBooksService;
    deletion = new MachineDeletionService(
      fixture.database,
      fixture.serviceDatabase,
      priceBooks,
      upFront,
    );
  });
  afterAll(() => fixture.db.close());
  beforeEach(async () => {
    await fixture.db.exec('BEGIN');
    world = await seedSharingWorld(fixture);
    actors = actorsOf(fixture, world);
    adminB = {
      tenantId: fixture.ids.setUpTenant,
      userId: fixture.ids.setUpAdmin,
      email: 'admin@old.test',
    };
  });
  afterEach(() => fixture.db.exec('ROLLBACK'));

  const machineId = () => world.ownB.id;
  const setState = (state: string) =>
    fixture.query(`UPDATE machines SET lifecycle_state = $2 WHERE id = $1`, [
      machineId(),
      state,
    ]);
  const addInterval = (
    activatedOn: string,
    billingEnd: string | null,
    deactivatedAt: string | null = null,
  ) =>
    fixture.query(
      `INSERT INTO billing.machine_activations (machine_id, billing_account_id, activated_on, billing_end, deactivation_requested_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        machineId(),
        fixture.ids.setUpAccount,
        activatedOn,
        billingEnd,
        deactivatedAt,
      ],
    );
  const setPlan = (term: 'monthly' | 'annual') =>
    fixture.query(
      `UPDATE billing.subscriptions SET term = $2::varchar, committed_qty = CASE WHEN $2::varchar = 'annual' THEN 10 END,
         annual_months_charged = CASE WHEN $2::varchar = 'annual' THEN 10 END
       WHERE billing_account_id = $1 AND plan_code = 'ASSET_PRO'`,
      [fixture.ids.setUpAccount, term],
    );
  const addPlanIfMissing = () =>
    fixture.query(
      `INSERT INTO billing.subscriptions (billing_account_id, plan_code, price_book_id, term, current_period_start, current_period_end)
       SELECT $1, 'ASSET_PRO', b.id, 'monthly', '2026-01-01', '2027-01-01'
       FROM billing.price_books b
       WHERE b.plan_code = 'ASSET_PRO'
         AND NOT EXISTS (SELECT 1 FROM billing.subscriptions s
                         WHERE s.billing_account_id = $1 AND s.plan_code = 'ASSET_PRO')
       ORDER BY b.version DESC LIMIT 1`,
      [fixture.ids.setUpAccount],
    );
  const addInvoice = (periodStart: string, status: string) =>
    fixture.query(
      `INSERT INTO billing.invoices (billing_account_id, currency, total_ex_gst_cents, kind, period_start, period_end, status)
       VALUES ($1, 'AUD', 1000, 'monthly', $2::date, ($2::date + interval '1 month')::date, $3)`,
      [fixture.ids.setUpAccount, periodStart, status],
    );
  const closeOpenCases = () =>
    fixture.query(
      `UPDATE support_cases SET status = 'closed' WHERE machine_id = $1`,
      [machineId()],
    );
  const remove = () =>
    deletion.deleteMachine(adminB, machineId(), 'Scrapped', NOW);
  const listed = async () =>
    (
      await services.fleet.listMachines(adminB, new ListMachinesQueryDto())
    ).items.map((machine) => machine.id);

  beforeEach(async () => {
    await closeOpenCases();
  });

  it('refuses an active machine, whatever the screen showed', async () => {
    await expect(remove()).rejects.toMatchObject({ status: 409 });
    expect(await listed()).toContain(machineId());
  });

  it('deletes a machine never billed: gone everywhere, row kept, audited', async () => {
    await setState('registered');

    await remove();

    expect(await listed()).not.toContain(machineId());
    await expect(
      services.history.getMachine(adminB, machineId()),
    ).rejects.toMatchObject({ status: 404 });
    const { rows } = await fixture.query(
      `SELECT deleted_at FROM machines WHERE id = $1`,
      [machineId()],
    );
    expect(rows[0].deleted_at).not.toBeNull();
    const audit = await fixture.query(
      `SELECT metadata->>'reason' AS reason FROM audit_logs
       WHERE entity_type = 'machine' AND action = 'delete' AND entity_id = $1`,
      [machineId()],
    );
    expect(audit.rows).toEqual([{ reason: 'Scrapped' }]);
  });

  it('frees the serial number to register again', async () => {
    await setState('registered');
    await remove();
    const inserted = await fixture.insertMachine(fixture.ids.setUpTenant);
    await expect(
      fixture.query(
        `UPDATE machines SET serial_number = 'SER-PLANT-B1' WHERE id = $1`,
        [inserted],
      ),
    ).resolves.toBeDefined();
  });

  it('still refuses a serial on a live machine', async () => {
    const inserted = await fixture.insertMachine(fixture.ids.setUpTenant);
    await fixture.db.exec('SAVEPOINT duplicate');
    await expect(
      fixture.query(
        `UPDATE machines SET serial_number = 'SER-PLANT-B1' WHERE id = $1`,
        [inserted],
      ),
    ).rejects.toBeDefined();
    await fixture.db.exec('ROLLBACK TO SAVEPOINT duplicate');
  });

  describe('final charge', () => {
    // Deactivated on 7 Nov (Brisbane), asked on 20 Nov.
    const NOV_20 = new Date('2026-11-20T02:00:00Z');
    const setUpDeactivated = async () => {
      await setState('registered');
      await addPlanIfMissing();
      await addInterval('2026-10-25', '2026-12-01', '2026-11-07T02:00:00Z');
      await addInvoice('2026-10-01', 'paid');
    };
    const check = () => deletion.checkDeletion(adminB, machineId(), NOV_20);
    const pay = () => deletion.payFinalCharge(adminB, machineId(), NOV_20);
    const markFinalPaid = () =>
      fixture.query(
        `UPDATE billing.invoices SET status = 'paid' WHERE kind = 'machine_final'`,
      );

    it('quotes the days used, then blocks until it is paid, then deletes', async () => {
      await setUpDeactivated();

      const due = await check();
      expect(due.blocker).toBe('final_charge_due');
      expect(due.finalCharge).toMatchObject({
        amountCents: 817,
        months: [
          {
            daysUsed: 7,
            daysInMonth: 30,
            monthlyRateCents: 3500,
            amountCents: 817,
          },
        ],
      });
      await expect(
        deletion.deleteMachine(adminB, machineId(), 'Scrapped', NOV_20),
      ).rejects.toMatchObject({ status: 409 });

      const raised = await pay();
      expect(raised.blocker).toBe('unpaid_invoices');
      expect(raised.unpaidInvoices[0].isFinalCharge).toBe(true);
      expect(finalise).toHaveBeenCalled();
      const charge = await fixture.query(
        `SELECT days_used, amount_cents, last_used_on::text FROM billing.machine_final_charges WHERE machine_id = $1`,
        [machineId()],
      );
      expect(charge.rows).toEqual([
        {
          days_used: 7,
          amount_cents: expect.anything(),
          last_used_on: '2026-11-07',
        },
      ]);

      await markFinalPaid();
      expect((await check()).canDelete).toBe(true);
      await deletion.deleteMachine(adminB, machineId(), 'Scrapped', NOV_20);
      expect(await listed()).not.toContain(machineId());
    });

    describe("when last month's invoice hasn't been issued", () => {
      const setUpWithoutOctoberInvoice = async () => {
        await setState('registered');
        await addPlanIfMissing();
        await addInterval('2026-10-25', '2026-12-01', '2026-11-07T02:00:00Z');
      };

      it('takes both months on one invoice, then deletes', async () => {
        await setUpWithoutOctoberInvoice();
        const due = await check();
        expect(due.blocker).toBe('final_charge_due');
        expect(due.finalCharge?.amountCents).toBe(1607);

        const raised = await pay();
        expect(raised.unpaidInvoices).toHaveLength(1);
        const { rows } = await fixture.query(
          `SELECT c.period_start::text, c.days_used, c.amount_cents, i.total_ex_gst_cents
           FROM billing.machine_final_charges c
           JOIN billing.invoices i ON i.id = c.invoice_id
           WHERE c.machine_id = $1 ORDER BY c.period_start`,
          [machineId()],
        );
        expect(rows.map((row) => row.period_start)).toEqual([
          '2026-10-01',
          '2026-11-01',
        ]);
        expect(rows.map((row) => Number(row.amount_cents))).toEqual([790, 817]);
        expect(Number(rows[0].total_ex_gst_cents)).toBe(1607);

        await pay();
        const again = await fixture.query(
          `SELECT count(*)::int AS count FROM billing.invoices WHERE kind = 'machine_final'`,
        );
        expect(again.rows[0].count).toBe(1);

        await markFinalPaid();
        expect((await check()).canDelete).toBe(true);
        await deletion.deleteMachine(adminB, machineId(), 'Scrapped', NOV_20);
        expect(await listed()).not.toContain(machineId());
      });

      it('charges nothing if the run invoices the month while paying', async () => {
        await setUpWithoutOctoberInvoice();
        const lock = jest
          .spyOn(deletionRepository, 'lockAccountBilling')
          .mockImplementationOnce(async () => {
            await addInvoice('2026-10-01', 'draft');
          });
        await expect(pay()).rejects.toMatchObject({ status: 409 });
        lock.mockRestore();
        const { rows } = await fixture.query(
          `SELECT count(*)::int AS count FROM billing.machine_final_charges WHERE machine_id = $1`,
          [machineId()],
        );
        expect(rows[0].count).toBe(0);
      });
    });

    it('raises one charge however many times it is asked', async () => {
      await setUpDeactivated();
      await pay();
      await pay();
      const { rows } = await fixture.query(
        `SELECT count(*)::int AS count FROM billing.machine_final_charges WHERE machine_id = $1`,
        [machineId()],
      );
      expect(rows[0].count).toBe(1);
    });

    it('asks for an unpaid earlier invoice before charging', async () => {
      await setState('registered');
      await addPlanIfMissing();
      await addInterval('2026-10-25', '2026-12-01', '2026-11-07T02:00:00Z');
      await addInvoice('2026-10-01', 'synced');
      const before = await pay();
      expect(before.blocker).toBe('unpaid_invoices');
      const { rows } = await fixture.query(
        `SELECT count(*)::int AS count FROM billing.machine_final_charges WHERE machine_id = $1`,
        [machineId()],
      );
      expect(rows[0].count).toBe(0);
    });

    it('waits for the month-end run on an annual plan', async () => {
      await setUpDeactivated();
      await setPlan('annual');
      expect((await check()).blocker).toBe('awaiting_final_invoice');
      await expect(pay()).rejects.toMatchObject({ status: 409 });
    });

    it('lets a void charge be raised again', async () => {
      await setUpDeactivated();
      await pay();
      await fixture.query(
        `UPDATE billing.invoices SET status = 'void' WHERE kind = 'machine_final'`,
      );
      expect((await check()).blocker).toBe('final_charge_due');
    });

    it('closed months are settled by paid monthly invoices alone', async () => {
      await setState('registered');
      await addPlanIfMissing();
      await addInterval('2026-10-15', '2026-12-01', '2026-11-05T02:00:00Z');
      await addInvoice('2026-10-01', 'paid');
      await addInvoice('2026-11-01', 'synced');
      expect(
        (await deletion.checkDeletion(adminB, machineId(), NOW)).blocker,
      ).toBe('unpaid_invoices');
      await fixture.query(
        `UPDATE billing.invoices SET status = 'paid' WHERE period_start = '2026-11-01'`,
      );
      await remove();
      expect(await listed()).not.toContain(machineId());
      const intervals = await fixture.query(
        `SELECT 1 FROM billing.machine_activations WHERE machine_id = $1 AND deleted_at IS NULL`,
        [machineId()],
      );
      expect(intervals.rows).toHaveLength(1);
    });

    it('settles a closed month with nothing to bill once the run passed it', async () => {
      await setState('archived');
      await addInterval('2026-10-15', '2026-12-01');
      await fixture.query(
        `INSERT INTO billing.daily_billable_counts (billing_account_id, day, active_machines, tech_seats)
         VALUES ($1, '2026-12-01', 0, 0)`,
        [fixture.ids.setUpAccount],
      );
      expect(
        (await deletion.checkDeletion(adminB, machineId(), NOW)).canDelete,
      ).toBe(true);
    });

    it('leaves the machine out of the month-end peak, unless its charge is void', async () => {
      await setUpDeactivated();
      await pay();
      const intervals = await listFinalChargedIntervals(
        fixture.serviceDatabase,
        fixture.ids.setUpAccount,
        '2026-11-01',
        '2026-12-01',
      );
      expect(intervals).toEqual([
        { startedOn: '2026-10-25', billingEnd: '2026-12-01' },
      ]);

      await fixture.query(
        `UPDATE billing.invoices SET status = 'void' WHERE kind = 'machine_final'`,
      );
      expect(
        await listFinalChargedIntervals(
          fixture.serviceDatabase,
          fixture.ids.setUpAccount,
          '2026-11-01',
          '2026-12-01',
        ),
      ).toEqual([]);
    });

    it('finds a live charge to stop it being reactivated that month', async () => {
      await setUpDeactivated();
      expect(
        await hasLiveFinalCharge(
          fixture.serviceDatabase,
          machineId(),
          '2026-11-01',
        ),
      ).toBe(false);
      await pay();
      expect(
        await hasLiveFinalCharge(
          fixture.serviceDatabase,
          machineId(),
          '2026-11-01',
        ),
      ).toBe(true);
      expect(
        await hasLiveFinalCharge(
          fixture.serviceDatabase,
          machineId(),
          '2026-12-01',
        ),
      ).toBe(false);
    });
  });

  it('blocks on an open support case', async () => {
    await setState('registered');
    await fixture.query(
      `UPDATE support_cases SET status = 'open' WHERE machine_id = $1`,
      [machineId()],
    );
    expect(
      (await deletion.checkDeletion(adminB, machineId(), NOW)).blocker,
    ).toBe('open_cases');
  });

  it('disconnects its machine app', async () => {
    await setState('registered');
    const device = await fixture.query(
      `INSERT INTO mc_devices (tenant_id, machine_id) VALUES ($1, $2) RETURNING id`,
      [fixture.ids.setUpTenant, machineId()],
    );
    await remove();
    const { rows } = await fixture.query(
      `SELECT disabled_at FROM mc_devices WHERE id = $1`,
      [device.rows[0].id],
    );
    expect(rows[0].disabled_at).not.toBeNull();
  });

  it("doesn't let another organisation or a share delete it", async () => {
    await setState('registered');
    await expect(
      deletion.deleteMachine(actors.adminA, machineId(), 'Nope', NOW),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('takes a deleted machine away from those it is shared with', async () => {
    await setState('registered');
    const group = await services.groups.createGroup(actors.owner, {
      name: 'Shared B',
    });
    await services.groupMachines.addMachines(actors.owner, group.id, [
      machineId(),
    ]);
    await services.assignments.grant(actors.owner, group.id, {
      targetType: 'organisation',
      targetId: fixture.ids.customerTenant,
      accessLevel: 'view',
    });
    await services.history.getMachine(actors.adminA, machineId());

    await remove();

    await expect(
      services.history.getMachine(actors.adminA, machineId()),
    ).rejects.toMatchObject({ status: 404 });
  });
});
