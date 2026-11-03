import {
  findTransferMachine,
  findVisibleLifecycleMachine,
} from '../../src/machineLifecycle/visibleMachine';
import { ListMachinesQueryDto } from '../../src/machineFleet/dto/listMachinesQueryDto';
import { ListSupportCasesQueryDto } from '../../src/supportCases/dto/listSupportCasesQueryDto';
import {
  BillingTestDatabase,
  createBillingTestDatabase,
} from '../billing/billingTestDatabase';
import {
  actorsOf,
  createSharedGroup,
  seedSharingWorld,
  servicesOf,
  SharingWorld,
} from './machineSharingFixtures';

// What 'view' and 'contribute' let organisation B do on organisation A's
// shared machine, and what a shared machine never allows.
describe('shared machine access levels', () => {
  let fixture: BillingTestDatabase;
  let world: SharingWorld;
  let services: ReturnType<typeof servicesOf>;
  let actors: ReturnType<typeof actorsOf>;

  beforeAll(async () => {
    fixture = await createBillingTestDatabase();
    services = servicesOf(fixture);
  });
  afterAll(() => fixture.db.close());
  beforeEach(async () => {
    await fixture.db.exec('BEGIN');
    world = await seedSharingWorld(fixture);
    actors = actorsOf(fixture, world);
  });
  afterEach(() => fixture.db.exec('ROLLBACK'));

  const shareWithB = async (accessLevel: 'view' | 'contribute') => {
    const group = await createSharedGroup(services, actors.owner, world);
    await services.assignments.grant(actors.owner, group.id, {
      targetType: 'organisation',
      targetId: fixture.ids.setUpTenant,
      accessLevel,
    });
    return group;
  };
  const entry = {
    entryType: 'inspection' as const,
    description: 'Checked tracks',
  };
  const newCase = (machineId: string) => ({
    subject: 'Track tension',
    category: 'alarm' as const,
    priority: 'P3' as const,
    machineId,
    description: 'Left track is loose',
  });

  it("refuses history and cases from a 'view' share (403)", async () => {
    await shareWithB('view');
    await expect(
      services.history.createEntry(actors.techB, world.shared1.id, entry),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      services.cases.createCase(actors.techB, newCase(world.shared1.id)),
    ).rejects.toMatchObject({ status: 403 });
    const options = await services.cases.getOptions(actors.techB);
    expect(options.machines.map((machine) => machine.id)).toEqual([
      world.ownB.id,
    ]);
  });

  it("lets 'contribute' add history and cases that belong to the owning organisation", async () => {
    await shareWithB('contribute');
    const created = await services.history.createEntry(
      actors.techB,
      world.shared1.id,
      entry,
    );
    const historyRow = (
      await fixture.query(
        'SELECT tenant_id, created_by FROM technical_history_entries WHERE id = $1',
        [created.id],
      )
    ).rows[0];
    expect(historyRow).toEqual({
      tenant_id: fixture.ids.customerTenant,
      created_by: world.techB,
    });
    const ownerView = await services.history.listHistory(
      actors.adminA,
      world.shared1.id,
    );
    expect(ownerView.find((item) => item.id === created.id)).toMatchObject({
      author: null,
      authorOrganisationName: 'Old Co',
    });

    const options = await services.cases.getOptions(actors.techB);
    expect(options.machines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: world.shared1.id,
          sharedByOrganisationName: 'Pit Crew',
        }),
      ]),
    );
    const supportCase = await services.cases.createCase(
      actors.techB,
      newCase(world.shared1.id),
    );
    const caseRow = (
      await fixture.query(
        'SELECT tenant_id, created_by FROM support_cases WHERE case_number = $1',
        [supportCase.caseNumber],
      )
    ).rows[0];
    expect(caseRow).toEqual({
      tenant_id: fixture.ids.customerTenant,
      created_by: world.techB,
    });
    await expect(
      services.cases.getCase(actors.techB, supportCase.caseNumber),
    ).resolves.toMatchObject({ caseNumber: supportCase.caseNumber });
    const ownerCases = await services.cases.listCases(
      actors.adminA,
      Object.assign(new ListSupportCasesQueryDto(), { status: 'all' as const }),
    );
    expect(ownerCases.items.map((item) => item.caseNumber)).toContain(
      supportCase.caseNumber,
    );
  });

  it('never lets a shared user edit, change status, activate, archive or transfer the machine', async () => {
    await shareWithB('contribute');
    await expect(
      services.details.updateMachine(actors.techB, world.shared1.id, {
        site: 'Their pit',
      }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      services.fleet.updateStatus(actors.techB, world.shared1.id, {
        status: 'down',
      }),
    ).rejects.toMatchObject({ status: 404 });
    const lifecycle = await fixture.database.withActor(actors.techB, (client) =>
      findVisibleLifecycleMachine(client, actors.techB, world.shared1.id),
    );
    expect(lifecycle).toBeUndefined();
    const transfer = await fixture.database.withActor(actors.techB, (client) =>
      findTransferMachine(client, actors.techB, world.shared1.id),
    );
    expect(transfer).toEqual({ machine: undefined, fleetMachine: null });
    const listed = await services.fleet.listMachines(
      actors.techB,
      Object.assign(new ListMachinesQueryDto(), { source: 'shared' }),
    );
    expect(listed.items[0]).toMatchObject({
      availableActions: [],
      canRequestTransfer: false,
    });
  });

  it("never shows a shared user the owning organisation's billing or people", async () => {
    await shareWithB('contribute');
    const readAs = (actor: typeof actors.techB) =>
      fixture.asRole('field_app', actor, async (client) => ({
        users: (
          await client.query('SELECT id FROM users WHERE tenant_id = $1', [
            fixture.ids.customerTenant,
          ])
        ).rows,
        billing: (
          await client.query(
            `SELECT a.id FROM billing.billing_accounts a
           JOIN tenants t ON t.billing_account_id = a.id WHERE t.id = $1`,
            [fixture.ids.customerTenant],
          )
        ).rows,
      }));
    expect(await readAs(actors.techB)).toEqual({ users: [], billing: [] });
    const ownView = await readAs(actors.adminA);
    expect(ownView.users.length).toBeGreaterThan(0);
    expect(ownView.billing).toHaveLength(1);
  });
});
