import { getAccessibleMachineScope } from '../../src/machineGroups/access/getAccessibleMachineScope';
import { moveMachinesToGroup } from '../../src/machineGroups/moveMachinesToGroup';
import { CreateMachineGroupDto } from '../../src/machineGroups/dto/machineGroupDtos';
import {
  BillingTestDatabase,
  createBillingTestDatabase,
} from '../billing/billingTestDatabase';
import {
  actorsOf,
  MachineGroupWorld,
  seedMachineGroupWorld,
  servicesOf,
} from './machineGroupFixtures';

// Creating, renaming and deleting groups and moving machines between them,
// against every migration as the field_app role.
describe('machine groups', () => {
  let fixture: BillingTestDatabase;
  let world: MachineGroupWorld;
  let services: ReturnType<typeof servicesOf>;
  let actors: ReturnType<typeof actorsOf>;

  beforeAll(async () => {
    fixture = await createBillingTestDatabase();
    services = servicesOf(fixture);
    actors = actorsOf(fixture);
  });
  afterAll(() => fixture.db.close());
  beforeEach(async () => {
    await fixture.db.exec('BEGIN');
    world = await seedMachineGroupWorld(fixture);
  });
  afterEach(() => fixture.db.exec('ROLLBACK'));

  const auditRows = async (entityType: string) =>
    (
      await fixture.query(
        `SELECT action, entity_id, metadata FROM audit_logs
         WHERE tenant_id = $1 AND entity_type = $2 ORDER BY created_at, id`,
        [world.tenantId, entityType],
      )
    ).rows;
  const machineGroupOf = async (machineId: string) =>
    (
      await fixture.query('SELECT group_id FROM machines WHERE id = $1', [
        machineId,
      ])
    ).rows[0].group_id as string | null;
  const accessRowCount = async (groupId: string) =>
    Number(
      (
        await fixture.query(
          'SELECT count(*) AS n FROM user_machine_group_access WHERE group_id = $1',
          [groupId],
        )
      ).rows[0].n,
    );

  describe('groups', () => {
    it('lists machine and user counts per group', async () => {
      const groups = await services.groups.listGroups(actors.admin);
      expect(
        groups.map((group) => [
          group.name,
          group.machineCount,
          group.userCount,
        ]),
      ).toEqual([
        ['ABC Earthmoving', 1, 1],
        ['XYZ Haulage', 1, 0],
      ]);
      const detail = await services.groups.getGroup(
        actors.admin,
        world.groups.abc,
      );
      expect(detail.users.map((user) => user.email)).toEqual(['tech@pit.test']);
    });

    it('creates a group, refusing a name already used ignoring case, and audits it', async () => {
      const created = await services.groups.createGroup(
        actors.admin,
        Object.assign(new CreateMachineGroupDto(), {
          name: 'Delta Mining',
          colour: '#4A34C7',
          contactName: 'Dee',
        }),
      );
      expect(created).toMatchObject({
        name: 'Delta Mining',
        machineCount: 0,
        contactName: 'Dee',
      });
      await expect(
        services.groups.createGroup(actors.admin, { name: 'abc earthmoving' }),
      ).rejects.toMatchObject({ status: 409 });
      expect(await auditRows('machine_group')).toEqual([
        expect.objectContaining({ action: 'create', entity_id: created.id }),
      ]);
    });

    it('audits a rename with the name before and after', async () => {
      await services.groups.updateGroup(actors.admin, world.groups.abc, {
        name: 'ABC Civil',
      });
      const [entry] = await auditRows('machine_group');
      expect(entry.metadata).toMatchObject({
        renamed: true,
        before: { name: 'ABC Earthmoving' },
        after: { name: 'ABC Civil' },
      });
    });

    it('asks for force to delete a group that has machines', async () => {
      await expect(
        services.groups.deleteGroup(actors.admin, world.groups.abc, false),
      ).rejects.toMatchObject({
        status: 409,
        response: expect.objectContaining({
          code: 'group_has_machines',
          machineCount: 1,
        }),
      });
      expect(await machineGroupOf(world.machines.abcMachine)).toBe(
        world.groups.abc,
      );
    });

    it("deleting ungroups its machines and removes everyone's access to it", async () => {
      await services.groups.deleteGroup(actors.admin, world.groups.abc, true);
      expect(await machineGroupOf(world.machines.abcMachine)).toBeNull();
      expect(await accessRowCount(world.groups.abc)).toBe(0);
      expect(
        (await services.groups.listGroups(actors.admin)).map(
          (group) => group.name,
        ),
      ).toEqual(['XYZ Haulage']);
      // Terry's only group is gone: still 'selected', so no machines at all.
      expect(
        await getAccessibleMachineScope(fixture.database as never, actors.tech),
      ).toEqual({
        kind: 'groups',
        groupIds: [],
      });
      const [entry] = await auditRows('machine_group');
      expect(entry).toMatchObject({ action: 'delete' });
      expect(entry.metadata.ungroupedMachineIds).toEqual([
        world.machines.abcMachine,
      ]);
      expect(entry.metadata.removedUserIds).toEqual([actors.tech.userId]);
    });

    it("frees a deleted group's name for a new group", async () => {
      await services.groups.deleteGroup(actors.admin, world.groups.xyz, true);
      await expect(
        services.groups.createGroup(actors.admin, { name: 'XYZ Haulage' }),
      ).resolves.toMatchObject({ name: 'XYZ Haulage' });
    });
  });

  describe('moving machines', () => {
    const move = (machineIds: string[], groupId: string | null) =>
      fixture.database.withActor(actors.admin, (client) =>
        moveMachinesToGroup(client, actors.admin, { machineIds, groupId }),
      );

    it('moves machines in bulk and audits each move with before and after', async () => {
      const result = await move(
        [world.machines.abcMachine, world.machines.looseMachine],
        world.groups.xyz,
      );
      expect(result).toEqual({ moved: 2, unchanged: 0 });
      expect(await machineGroupOf(world.machines.looseMachine)).toBe(
        world.groups.xyz,
      );
      const moves = (await auditRows('machine')).filter(
        (row) => row.metadata.change === 'group',
      );
      const pairs = moves.map((row) => [
        row.metadata.before.groupName,
        row.metadata.after.groupName,
      ]);
      expect(pairs).toHaveLength(2);
      expect(pairs).toEqual(
        expect.arrayContaining([
          ['ABC Earthmoving', 'XYZ Haulage'],
          [null, 'XYZ Haulage'],
        ]),
      );
    });

    it('takes machines out of their group with null', async () => {
      await move([world.machines.abcMachine], null);
      expect(await machineGroupOf(world.machines.abcMachine)).toBeNull();
    });

    it("moves nothing when any machine is another organisation's", async () => {
      await expect(
        move(
          [world.machines.abcMachine, world.machines.oldCoMachine],
          world.groups.xyz,
        ),
      ).rejects.toMatchObject({ status: 404 });
      expect(await machineGroupOf(world.machines.abcMachine)).toBe(
        world.groups.abc,
      );
      await expect(
        move([world.machines.abcMachine], world.groups.oldCoGroup),
      ).rejects.toMatchObject({
        status: 400,
      });
    });

    it('leaves the group behind when a machine is transferred to another organisation', async () => {
      await fixture.query('UPDATE machines SET tenant_id = $2 WHERE id = $1', [
        world.machines.abcMachine,
        fixture.ids.setUpTenant,
      ]);
      expect(await machineGroupOf(world.machines.abcMachine)).toBeNull();
    });
  });
});
