import { NotFoundException } from '@nestjs/common';
import { ListMachinesQueryDto } from '../../src/machineFleet/dto/listMachinesQueryDto';
import { ListSupportCasesQueryDto } from '../../src/supportCases/dto/listSupportCasesQueryDto';
import { AskAssistantDto } from '../../src/aiAssistant/dto/askAssistantDto';
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

// What someone limited to selected machine groups can see, through the real
// services as the field_app role (RLS on), against every migration.
describe('machine scope', () => {
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

  const listQuery = (filters: Partial<ListMachinesQueryDto> = {}) =>
    Object.assign(new ListMachinesQueryDto(), filters);
  const listIds = async (
    actor: typeof actors.tech,
    filters: Partial<ListMachinesQueryDto> = {},
  ) =>
    (await services.fleet.listMachines(actor, listQuery(filters))).items
      .map((machine) => machine.id)
      .sort();
  const caseQuery = () =>
    Object.assign(new ListSupportCasesQueryDto(), { status: 'all' as const });
  const ask = (machineId: string) =>
    Object.assign(new AskAssistantDto(), {
      question: 'Why is it leaking?',
      machineId,
    });

  describe('a selected user', () => {
    it('lists only machines in their groups, with group name, and the total to match', async () => {
      const list = await services.fleet.listMachines(actors.tech, listQuery());
      expect(list.items.map((machine) => machine.id)).toEqual([
        world.machines.abcMachine,
      ]);
      expect(list.total).toBe(1);
      expect(list.items[0]).toMatchObject({
        groupId: world.groups.abc,
        groupName: 'ABC Earthmoving',
      });
    });

    it('finds nothing outside their groups by plant ID, serial or VIN', async () => {
      for (const search of ['PLANT-XYZ', 'XYZ-001', 'VIN-XYZ', 'PLANT-LOOSE']) {
        expect(await listIds(actors.tech, { search })).toEqual([]);
      }
      expect(await listIds(actors.tech, { search: 'PLANT-ABC' })).toEqual([
        world.machines.abcMachine,
      ]);
    });

    it('gets nothing for another group or ungrouped through the filters', async () => {
      expect(await listIds(actors.tech, { groupId: world.groups.xyz })).toEqual(
        [],
      );
      expect(await listIds(actors.tech, { ungrouped: true })).toEqual([]);
    });

    it('gets 404 for a machine in another group or ungrouped: detail, history, snapshots', async () => {
      for (const machineId of [
        world.machines.xyzMachine,
        world.machines.looseMachine,
      ]) {
        await expect(
          services.history.getMachine(actors.tech, machineId),
        ).rejects.toBeInstanceOf(NotFoundException);
        await expect(
          services.history.listHistory(actors.tech, machineId),
        ).rejects.toBeInstanceOf(NotFoundException);
        await expect(
          services.configuration.listSnapshots(actors.tech, machineId),
        ).rejects.toBeInstanceOf(NotFoundException);
      }
    });

    it('sees the detail and history of a machine in their group', async () => {
      const detail = await services.history.getMachine(
        actors.tech,
        world.machines.abcMachine,
      );
      expect(detail.group).toMatchObject({
        id: world.groups.abc,
        name: 'ABC Earthmoving',
      });
      const history = await services.history.listHistory(
        actors.tech,
        world.machines.abcMachine,
      );
      expect(history.map((entry) => entry.description)).toEqual([
        'Serviced ABC-001',
      ]);
    });

    it('sees support cases about their machines and about no machine, and 404 for the rest', async () => {
      const list = await services.cases.listCases(actors.tech, caseQuery());
      expect(list.items.map((item) => item.caseNumber).sort()).toEqual(
        [world.cases.abc, world.cases.none].map(Number).sort(),
      );
      for (const caseNumber of [world.cases.xyz, world.cases.loose]) {
        await expect(
          services.cases.getCase(actors.tech, Number(caseNumber)),
        ).rejects.toBeInstanceOf(NotFoundException);
      }
      const options = await services.cases.getOptions(actors.tech);
      expect(options.machines.map((machine) => machine.id)).toEqual([
        world.machines.abcMachine,
      ]);
    });

    it('gets no AI machine context outside their groups', async () => {
      await expect(
        services.ai.prepare(actors.tech, ask(world.machines.xyzMachine)),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        services.ai.prepare(actors.tech, ask(world.machines.looseMachine)),
      ).rejects.toBeInstanceOf(NotFoundException);
      const prepared = await services.ai.prepare(
        actors.tech,
        ask(world.machines.abcMachine),
      );
      expect(prepared.machineId).toBe(world.machines.abcMachine);
      expect(prepared.question.machineContext).toContain('ABC-001');
    });

    it('counts only their machines and cases on the dashboard', async () => {
      await fixture.query(
        `UPDATE machines SET status = 'down' WHERE tenant_id = $1`,
        [world.tenantId],
      );
      const summary = await services.dashboard.getSummary(actors.tech);
      expect(
        summary.machinesDown.machines.map((machine) => machine.id),
      ).toEqual([world.machines.abcMachine]);
      expect(summary.openCases.total).toBe(2);
    });

    it("doesn't see alerts about machines outside their groups in the bell", async () => {
      for (const machineId of [
        world.machines.abcMachine,
        world.machines.xyzMachine,
      ]) {
        await fixture.query(
          `INSERT INTO notifications (tenant_id, user_id, kind, title, body, link, entity_key)
           VALUES ($1, $2, 'alert', 'Down too long', '', '/machines', $3)`,
          [world.tenantId, actors.tech.userId, `machine:${machineId}`],
        );
      }
      const bell = await services.notifications.listNotifications(actors.tech, {
        unreadOnly: false,
        limit: 20,
      } as never);
      expect(bell.items).toHaveLength(1);
      expect(bell.unreadCount).toBe(1);
    });

    it('loses a group on their very next request', async () => {
      expect(await listIds(actors.tech)).toEqual([world.machines.abcMachine]);
      await services.access.setAccess(actors.admin, actors.tech.userId, {
        mode: 'selected',
        groupIds: [world.groups.xyz],
      });
      expect(await listIds(actors.tech)).toEqual([world.machines.xyzMachine]);
      await expect(
        services.history.getMachine(actors.tech, world.machines.abcMachine),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('an organisation admin', () => {
    it('sees every machine, grouped or not, and each filter', async () => {
      expect(await listIds(actors.admin)).toEqual(
        [
          world.machines.abcMachine,
          world.machines.xyzMachine,
          world.machines.looseMachine,
        ].sort(),
      );
      expect(await listIds(actors.admin, { ungrouped: true })).toEqual([
        world.machines.looseMachine,
      ]);
      expect(
        await listIds(actors.admin, { groupId: world.groups.xyz }),
      ).toEqual([world.machines.xyzMachine]);
      await expect(
        services.history.getMachine(actors.admin, world.machines.looseMachine),
      ).resolves.toMatchObject({ group: null });
    });

    it('still sees everything when stored as selected (admins always get all)', async () => {
      await fixture.query(
        `UPDATE users SET machine_access_mode = 'selected' WHERE id = $1`,
        [actors.admin.userId],
      );
      expect(await listIds(actors.admin)).toHaveLength(3);
    });
  });

  describe('across organisations', () => {
    it('never shows another organisation its machines or groups', async () => {
      expect(await listIds(actors.admin, { search: 'OLD-001' })).toEqual([]);
      expect(
        await listIds(actors.admin, { groupId: world.groups.oldCoGroup }),
      ).toEqual([]);
      await expect(
        services.history.getMachine(actors.admin, world.machines.oldCoMachine),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        services.groups.getGroup(actors.admin, world.groups.oldCoGroup),
      ).rejects.toBeInstanceOf(NotFoundException);
      const names = (await services.groups.listGroups(actors.admin)).map(
        (group) => group.name,
      );
      expect(names).toEqual(['ABC Earthmoving', 'XYZ Haulage']);
      expect(await listIds(actors.oldCoAdmin)).toEqual([
        world.machines.oldCoMachine,
      ]);
    });

    it("refuses to give someone another organisation's group", async () => {
      await expect(
        services.access.setAccess(actors.admin, actors.tech.userId, {
          mode: 'selected',
          groupIds: [world.groups.oldCoGroup],
        }),
      ).rejects.toMatchObject({ status: 400 });
    });
  });
});
