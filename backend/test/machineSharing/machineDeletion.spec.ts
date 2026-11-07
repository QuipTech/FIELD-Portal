import { MachineDeletionService } from '../../src/machineLifecycle/machineDeletion.service';
import { ListMachinesQueryDto } from '../../src/machineFleet/dto/listMachinesQueryDto';
import { AuthenticatedUser } from '../../src/auth/types/authenticatedUser';
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

  beforeAll(async () => {
    fixture = await createBillingTestDatabase();
    services = servicesOf(fixture);
    deletion = new MachineDeletionService(fixture.database);
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
  const addInterval = (activatedOn: string, billingEnd: string | null) =>
    fixture.query(
      `INSERT INTO billing.machine_activations (machine_id, billing_account_id, activated_on, billing_end)
       VALUES ($1, $2, $3, $4)`,
      [machineId(), fixture.ids.setUpAccount, activatedOn, billingEnd],
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

  it('keeps the machine until its final invoice is paid', async () => {
    await setState('registered');
    await addInterval('2026-10-15', '2026-12-01');
    await addInvoice('2026-10-01', 'paid');

    expect(
      (await deletion.checkDeletion(adminB, machineId(), NOW)).blocker,
    ).toBe('awaiting_final_invoice');

    await addInvoice('2026-11-01', 'synced');
    const unpaid = await deletion.checkDeletion(adminB, machineId(), NOW);
    expect(unpaid.blocker).toBe('unpaid_invoices');
    expect(unpaid.unpaidInvoices.map((item) => item.periodStart)).toEqual([
      '2026-11-01',
    ]);
    await expect(remove()).rejects.toMatchObject({ status: 409 });

    await fixture.query(
      `UPDATE billing.invoices SET status = 'paid' WHERE period_start = '2026-11-01'`,
    );
    await remove();
    expect(await listed()).not.toContain(machineId());
    const intervals = await fixture.query(
      `SELECT 1 FROM billing.machine_activations WHERE machine_id = $1 AND deleted_at IS NULL`,
      [machineId()],
    );
    expect(intervals.rowCount ?? intervals.rows.length).toBe(1);
  });

  it('settles a month with nothing to bill once the run has passed it', async () => {
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
