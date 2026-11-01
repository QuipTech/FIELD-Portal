import { randomUUID } from 'crypto';
import { AdminUserInvitationsService } from '../../src/adminUsers/adminUserInvitations.service';
import { FleetImportService } from '../../src/machineFleet/fleetImport/fleetImport.service';
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

// People's machine access (set by an admin and at invitation) and the
// fleet import's group column, against every migration as field_app.
describe('machine access', () => {
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
  const accessRowCount = async (groupId: string) =>
    Number(
      (
        await fixture.query(
          'SELECT count(*) AS n FROM user_machine_group_access WHERE group_id = $1',
          [groupId],
        )
      ).rows[0].n,
    );

  describe('set by an admin or at invitation', () => {
    it("needs a group for 'selected', and refuses it for an organisation admin", async () => {
      await expect(
        services.access.setAccess(actors.admin, actors.tech.userId, {
          mode: 'selected',
          groupIds: [],
        }),
      ).rejects.toMatchObject({ status: 400 });
      await expect(
        services.access.setAccess(actors.admin, actors.admin.userId, {
          mode: 'selected',
          groupIds: [world.groups.abc],
        }),
      ).rejects.toMatchObject({ status: 400 });
    });

    it('audits who changed whose access, before and after', async () => {
      const after = await services.access.setAccess(
        actors.admin,
        actors.tech.userId,
        { mode: 'all' },
      );
      expect(after).toEqual({
        machineAccessMode: 'all',
        effectiveMode: 'all',
        groups: [],
      });
      const [entry] = (await auditRows('user')).filter(
        (row) => row.metadata.change === 'machine_access',
      );
      expect(entry.entity_id).toBe(actors.tech.userId);
      expect(entry.metadata.before).toEqual({
        machineAccessMode: 'selected',
        groups: [{ id: world.groups.abc, name: 'ABC Earthmoving' }],
      });
      expect(entry.metadata.after).toEqual({
        machineAccessMode: 'all',
        groups: [],
      });
    });

    it("saves an invited person's groups, which apply from their first sign-in", async () => {
      const roleId = (
        await fixture.query(
          `SELECT id FROM roles WHERE name = 'Field Technician' AND is_system_role AND tenant_id IS NULL`,
        )
      ).rows[0].id as string;
      const cognito = {
        createInvitedUser: jest
          .fn()
          .mockResolvedValue({ sub: randomUUID(), username: 'new@pit.test' }),
        deleteUser: jest.fn(),
      };
      const invitations = new AdminUserInvitationsService(
        fixture.database,
        cognito as never,
        { deleteCognitoUsersForEmail: jest.fn() } as never,
        services.access,
      );
      const { id } = await invitations.inviteUser(
        actors.admin,
        { tenantId: world.tenantId, isPlatform: false },
        {
          email: 'new@pit.test',
          firstName: 'Nova',
          lastName: 'New',
          roleId,
          machineAccessMode: 'selected',
          groupIds: [world.groups.xyz],
        },
      );
      expect(await accessRowCount(world.groups.xyz)).toBe(1);
      await fixture.query(`UPDATE users SET status = 'active' WHERE id = $1`, [
        id,
      ]);
      const invited = {
        tenantId: world.tenantId,
        userId: id,
        email: 'new@pit.test',
      };
      const machines = await services.fleet.listMachines(
        invited,
        Object.assign({ page: 1, pageSize: 25 }),
      );
      expect(machines.items.map((machine) => machine.id)).toEqual([
        world.machines.xyzMachine,
      ]);
    });
  });

  describe('fleet CSV import', () => {
    const importer = () => new FleetImportService(fixture.database);
    const model = async () =>
      (
        await fixture.query(
          `SELECT mf.name AS make, mm.name AS model FROM machines m
           JOIN machine_manufacturers mf ON mf.id = m.manufacturer_id
           JOIN machine_models mm ON mm.id = m.model_id WHERE m.id = $1`,
          [world.machines.abcMachine],
        )
      ).rows[0] as { make: string; model: string };

    it('matches a group by name and creates a new one when an admin imports', async () => {
      const { make, model: modelName } = await model();
      const row = (serialNumber: string, group?: string) => ({
        serialNumber,
        make,
        model: modelName,
        group,
      });
      const preview = await importer().importFleet(actors.admin, {
        dryRun: true,
        rows: [
          row('NEW-1', 'abc earthmoving'),
          row('NEW-2', 'Delta Mining'),
          row('NEW-3'),
        ],
      });
      expect(preview).toMatchObject({
        dryRun: true,
        imported: 0,
        newGroups: ['Delta Mining'],
      });
      expect(preview.rows.every((result) => !result.errors.length)).toBe(true);
      const result = await importer().importFleet(actors.admin, {
        rows: [
          row('NEW-1', 'abc earthmoving'),
          row('NEW-2', 'Delta Mining'),
          row('NEW-3'),
        ],
      });
      expect(result.imported).toBe(3);
      const groups = await services.groups.listGroups(actors.admin);
      expect(groups.map((group) => [group.name, group.machineCount])).toEqual([
        ['ABC Earthmoving', 2],
        ['Delta Mining', 1],
        ['XYZ Haulage', 1],
      ]);
    });

    it("saves nothing when a row has an error, and won't let a non-admin create groups", async () => {
      const { make, model: modelName } = await model();
      await expect(
        importer().importFleet(actors.tech, {
          rows: [
            {
              serialNumber: 'NEW-1',
              make,
              model: modelName,
              group: 'ABC Earthmoving',
            },
            {
              serialNumber: 'NEW-2',
              make,
              model: modelName,
              group: 'Nobody Ltd',
            },
            { serialNumber: 'NEW-3', make, model: modelName },
          ],
        }),
      ).rejects.toMatchObject({
        status: 400,
        response: expect.objectContaining({
          code: 'import_has_errors',
          rows: [
            expect.objectContaining({ row: 1, errors: [] }),
            expect.objectContaining({
              row: 2,
              errors: [expect.stringContaining('no machine group')],
            }),
            expect.objectContaining({
              row: 3,
              errors: [expect.stringContaining('Choose one of your')],
            }),
          ],
        }),
      });
      const count = await fixture.query(
        `SELECT 1 FROM machines WHERE serial_number LIKE 'NEW-%'`,
      );
      expect(count.rowCount).toBe(0);
    });
  });
});
