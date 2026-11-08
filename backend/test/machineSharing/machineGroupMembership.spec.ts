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

const UNKNOWN_ID = '99999999-9999-4999-8999-999999999999';

// Setting one machine's groups in one step: "Manage groups".
describe("setting a machine's groups", () => {
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

  const groupIdsOf = async (machineId: string) =>
    (await services.groupMachines.listMachineGroups(actors.owner, machineId))
      .map((group) => group.id)
      .sort();
  const newGroup = (name: string) =>
    services.groups.createGroup(actors.owner, { name });

  it('moves a machine between groups, changing who can see it', async () => {
    const from = await createSharedGroup(services, actors.owner, world);
    const to = await newGroup('Site two');
    await services.assignments.grant(actors.owner, from.id, {
      targetType: 'organisation',
      targetId: fixture.ids.setUpTenant,
      accessLevel: 'view',
    });
    await expect(
      services.history.getMachine(actors.techB, world.shared1.id),
    ).resolves.toBeDefined();

    await services.groupMachines.setMachineGroups(
      actors.owner,
      world.shared1.id,
      [to.id],
    );

    expect(await groupIdsOf(world.shared1.id)).toEqual([to.id]);
    await expect(
      services.history.getMachine(actors.techB, world.shared1.id),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('adds to several groups and clears them all', async () => {
    const one = await newGroup('One');
    const two = await newGroup('Two');
    await services.groupMachines.setMachineGroups(
      actors.owner,
      world.private3.id,
      [one.id, two.id],
    );
    expect(await groupIdsOf(world.private3.id)).toEqual(
      [one.id, two.id].sort(),
    );
    await services.groupMachines.setMachineGroups(
      actors.owner,
      world.private3.id,
      [],
    );
    expect(await groupIdsOf(world.private3.id)).toEqual([]);
  });

  it('changes nothing when a group or the machine is unknown', async () => {
    const group = await createSharedGroup(services, actors.owner, world);
    const other = await newGroup('Other');
    await fixture.db.exec('SAVEPOINT attempt');
    await expect(
      services.groupMachines.setMachineGroups(actors.owner, world.shared1.id, [
        other.id,
        UNKNOWN_ID,
      ]),
    ).rejects.toMatchObject({ status: 404 });
    await fixture.db.exec('ROLLBACK TO SAVEPOINT attempt');
    expect(await groupIdsOf(world.shared1.id)).toEqual([group.id]);

    await expect(
      services.groupMachines.setMachineGroups(actors.owner, UNKNOWN_ID, []),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('refuses anyone but the platform administrator', async () => {
    const group = await newGroup('Admins only');
    await expect(
      services.groupMachines.setMachineGroups(actors.adminA, world.shared1.id, [
        group.id,
      ]),
    ).rejects.toBeDefined();
    expect(await groupIdsOf(world.shared1.id)).toEqual([]);
  });

  describe('moving several machines to one group', () => {
    it('takes each out of its groups and into the new one, at once', async () => {
      const from = await createSharedGroup(services, actors.owner, world);
      const to = await newGroup('Site two');
      const other = await newGroup('Other');
      await services.groupMachines.setMachineGroups(
        actors.owner,
        world.private3.id,
        [other.id, to.id],
      );

      const result = await services.groupMachines.moveMachinesToGroup(
        actors.owner,
        [world.shared1.id, world.private3.id],
        to.id,
      );

      expect(result).toEqual({
        moved: 2,
        group: { id: to.id, name: 'Site two' },
      });
      expect(await groupIdsOf(world.shared1.id)).toEqual([to.id]);
      expect(await groupIdsOf(world.private3.id)).toEqual([to.id]);
      expect((await groupIdsOf(world.shared1.id)).includes(from.id)).toBe(
        false,
      );
    });

    it("doesn't count a machine already only in that group", async () => {
      const to = await newGroup('Site two');
      await services.groupMachines.setMachineGroups(
        actors.owner,
        world.shared1.id,
        [to.id],
      );
      const result = await services.groupMachines.moveMachinesToGroup(
        actors.owner,
        [world.shared1.id],
        to.id,
      );
      expect(result.moved).toBe(0);
    });

    it('moves nothing when a machine or the group is unknown', async () => {
      const group = await createSharedGroup(services, actors.owner, world);
      const to = await newGroup('Site two');
      await fixture.db.exec('SAVEPOINT attempt');
      await expect(
        services.groupMachines.moveMachinesToGroup(
          actors.owner,
          [world.shared1.id, UNKNOWN_ID],
          to.id,
        ),
      ).rejects.toMatchObject({ status: 404 });
      await fixture.db.exec('ROLLBACK TO SAVEPOINT attempt');
      expect(await groupIdsOf(world.shared1.id)).toEqual([group.id]);

      await fixture.db.exec('SAVEPOINT unknown_group');
      await expect(
        services.groupMachines.moveMachinesToGroup(
          actors.owner,
          [world.shared1.id],
          UNKNOWN_ID,
        ),
      ).rejects.toMatchObject({ status: 404 });
      await fixture.db.exec('ROLLBACK TO SAVEPOINT unknown_group');
      expect(await groupIdsOf(world.shared1.id)).toEqual([group.id]);
    });

    it('refuses anyone but the platform administrator', async () => {
      const to = await newGroup('Admins only');
      await fixture.db.exec('SAVEPOINT attempt');
      await expect(
        services.groupMachines.moveMachinesToGroup(
          actors.adminA,
          [world.shared1.id],
          to.id,
        ),
      ).rejects.toBeDefined();
      await fixture.db.exec('ROLLBACK TO SAVEPOINT attempt');
      expect(await groupIdsOf(world.shared1.id)).toEqual([]);
    });
  });

  it('audits each changed group for the administrator and the owner', async () => {
    const from = await createSharedGroup(services, actors.owner, world);
    const to = await newGroup('Site two');

    await services.groupMachines.setMachineGroups(
      actors.owner,
      world.shared1.id,
      [to.id],
    );

    const { rows } = await fixture.query(
      `SELECT tenant_id, entity_id, metadata->>'change' AS change FROM audit_logs
       WHERE entity_type = 'machine_group' AND metadata ? 'change'
         AND (entity_id = $1 OR (entity_id = $2 AND metadata->>'change' = 'machine_removed'))`,
      [to.id, from.id],
    );
    const seen = rows.map(
      (row) => `${row.tenant_id}|${row.entity_id}|${row.change}`,
    );
    expect(seen.sort()).toEqual(
      [
        `${fixture.ids.platformTenant}|${to.id}|machines_added`,
        `${fixture.ids.customerTenant}|${to.id}|machines_added`,
        `${fixture.ids.platformTenant}|${from.id}|machine_removed`,
        `${fixture.ids.customerTenant}|${from.id}|machine_removed`,
      ].sort(),
    );
  });
});
