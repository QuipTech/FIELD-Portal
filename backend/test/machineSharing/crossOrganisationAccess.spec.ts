import { ListMachinesQueryDto } from '../../src/machineFleet/dto/listMachinesQueryDto';
import { ListSupportCasesQueryDto } from '../../src/supportCases/dto/listSupportCasesQueryDto';
import { AskAssistantDto } from '../../src/aiAssistant/dto/askAssistantDto';
import { AuthenticatedUser } from '../../src/auth/types/authenticatedUser';
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

// Organisation B seeing organisation A's machines only through an active
// group assignment: through the real services and raw SQL, as the
// field_app role (RLS on), against every migration.
describe('cross-organisation machine access', () => {
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

  const listIds = async (
    actor: AuthenticatedUser,
    filters: Partial<ListMachinesQueryDto> = {},
  ) =>
    (
      await services.fleet.listMachines(
        actor,
        Object.assign(new ListMachinesQueryDto(), filters),
      )
    ).items
      .map((machine) => machine.id)
      .sort();
  const allCases = () =>
    Object.assign(new ListSupportCasesQueryDto(), { status: 'all' as const });
  const ask = (machineId: string) =>
    Object.assign(new AskAssistantDto(), { question: 'Leak?', machineId });
  const grantToB = (groupId: string, accessLevel: 'view' | 'contribute') =>
    services.assignments.grant(actors.owner, groupId, {
      targetType: 'organisation',
      targetId: fixture.ids.setUpTenant,
      accessLevel,
    });
  const rawMachineCount = (actor: AuthenticatedUser, machineId: string) =>
    fixture.asRole('field_app', actor, async (client) =>
      Number(
        (
          await client.query(
            `SELECT (SELECT count(*) FROM machines WHERE id = $1)
                  + (SELECT count(*) FROM technical_history_entries WHERE machine_id = $1) AS n`,
            [machineId],
          )
        ).rows[0].n,
      ),
    );

  const expectNoAccessTo = async (machineId: string, caseNumber: number) => {
    expect(await listIds(actors.techB)).toEqual([world.ownB.id]);
    for (const search of ['PLANT-A1', 'SER-PLANT-A1', 'VIN-PLANT-A1']) {
      expect(await listIds(actors.techB, { search })).toEqual([]);
    }
    for (const read of [
      services.history.getMachine(actors.techB, machineId),
      services.history.listHistory(actors.techB, machineId),
      services.configuration.listSnapshots(actors.techB, machineId),
      services.cases.getCase(actors.techB, caseNumber),
      services.ai.prepare(actors.techB, ask(machineId)),
    ]) {
      await expect(read).rejects.toMatchObject({ status: 404 });
    }
    const cases = await services.cases.listCases(actors.techB, allCases());
    expect(cases.items.map((item) => item.caseNumber)).toEqual([
      world.ownB.caseNumber,
    ]);
    expect(await rawMachineCount(actors.techB, machineId)).toBe(0);
  };

  it('gives an organisation with no assignment nothing of another organisation, anywhere', async () => {
    await createSharedGroup(services, actors.owner, world);
    await expectNoAccessTo(world.shared1.id, world.shared1.caseNumber);
  });

  it('shows assigned machines at their level and, once revoked, 404s them again', async () => {
    const group = await createSharedGroup(services, actors.owner, world);
    const [assignment] = await grantToB(group.id, 'view');
    expect(await listIds(actors.techB)).toEqual(
      [world.ownB.id, world.shared1.id, world.shared2.id].sort(),
    );
    expect(await listIds(actors.techB, { source: 'shared' })).toEqual(
      [world.shared1.id, world.shared2.id].sort(),
    );
    expect(await listIds(actors.techB, { groupId: group.id })).toEqual(
      [world.shared1.id, world.shared2.id].sort(),
    );
    const detail = await services.history.getMachine(
      actors.techB,
      world.shared1.id,
    );
    expect(detail).toMatchObject({
      isShared: true,
      accessLevel: 'view',
      owningOrganisationName: 'Pit Crew',
      owner: null,
      assignedTechnicians: [],
    });
    const history = await services.history.listHistory(
      actors.techB,
      world.shared1.id,
    );
    expect(history).toEqual([
      expect.objectContaining({
        author: null,
        authorOrganisationName: 'Pit Crew',
      }),
    ]);
    // Pit Crew's own case on it stays Pit Crew's (only cases B raised show).
    await expect(
      services.cases.getCase(actors.techB, world.shared1.caseNumber),
    ).rejects.toMatchObject({ status: 404 });
    // The machine outside the group stays hidden.
    await expect(
      services.history.getMachine(actors.techB, world.private3.id),
    ).rejects.toMatchObject({ status: 404 });
    expect(await rawMachineCount(actors.techB, world.shared1.id)).toBe(2);

    await services.assignments.revoke(
      actors.owner,
      { groupId: group.id, assignmentId: assignment.id },
      'Contract ended',
    );
    await expectNoAccessTo(world.shared1.id, world.shared1.caseNumber);
  });

  it("limits a 'groups_only' person to assigned group machines, their own organisation's too", async () => {
    const group = await createSharedGroup(services, actors.owner, world);
    await services.assignments.grant(actors.owner, group.id, {
      targetType: 'user',
      targetId: world.techB,
      accessLevel: 'view',
    });
    await services.userAccess.setMode(
      actors.owner,
      { userId: world.techB, tenantId: fixture.ids.setUpTenant },
      'groups_only',
    );
    expect(await listIds(actors.techB)).toEqual(
      [world.shared1.id, world.shared2.id].sort(),
    );
    await expect(
      services.history.getMachine(actors.techB, world.ownB.id),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("gives a 'groups_only' person with no assignment an empty list, not an error", async () => {
    await services.userAccess.setMode(
      actors.owner,
      { userId: world.techB, tenantId: fixture.ids.setUpTenant },
      'groups_only',
    );
    const list = await services.fleet.listMachines(
      actors.techB,
      new ListMachinesQueryDto(),
    );
    expect(list).toMatchObject({ items: [], total: 0 });
  });

  it('RLS blocks raw reads of another organisation without app.user_id, even with an assignment', async () => {
    const group = await createSharedGroup(services, actors.owner, world);
    await grantToB(group.id, 'view');
    const asJob = await fixture.asRole(
      'field_app',
      { tenantId: fixture.ids.setUpTenant },
      async (client) =>
        (
          await client.query('SELECT id FROM machines WHERE id = $1', [
            world.shared1.id,
          ])
        ).rows,
    );
    expect(asJob).toEqual([]);
  });
});
