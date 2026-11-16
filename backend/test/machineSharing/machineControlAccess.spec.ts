import { AdminMachineControlService } from '../../src/machineControl/admin/adminMachineControl.service';
import { McDevicesService } from '../../src/machineControl/devices/mcDevices.service';
import { isMachineControlEnabled } from '../../src/machineControl/access/machineControlAccess';
import { MachineAppPairingService } from '../../src/machineControl/pairing/machineAppPairing.service';
import {
  BillingTestDatabase,
  createBillingTestDatabase,
} from '../billing/billingTestDatabase';
import {
  actorsOf,
  seedSharingWorld,
  SharingWorld,
} from './machineSharingFixtures';

// Who may use Machine Control, the platform administrator's switch, and the
// devices list the module's pages show.
describe('machine control access', () => {
  let fixture: BillingTestDatabase;
  let world: SharingWorld;
  let actors: ReturnType<typeof actorsOf>;
  let admin: AdminMachineControlService;
  let devices: McDevicesService;
  let pairing: MachineAppPairingService;

  beforeAll(async () => {
    fixture = await createBillingTestDatabase();
    admin = new AdminMachineControlService(fixture.database);
    devices = new McDevicesService(fixture.database);
    pairing = new MachineAppPairingService(fixture.database);
  });
  afterAll(() => fixture.db.close());
  beforeEach(async () => {
    await fixture.db.exec('BEGIN');
    world = await seedSharingWorld(fixture);
    actors = actorsOf(fixture, world);
  });
  afterEach(() => fixture.db.exec('ROLLBACK'));

  const codesOf = async (roleName: string) =>
    (
      await fixture.query(
        `SELECT p.code FROM roles r
         JOIN role_permissions rp ON rp.role_id = r.id
         JOIN permissions p ON p.id = rp.permission_id
         WHERE r.name = $1 AND r.is_system_role AND r.tenant_id IS NULL
           AND p.code LIKE 'mc.%' ORDER BY p.code`,
        [roleName],
      )
    ).rows.map((row) => row.code);
  const isOn = (tenantId: string) =>
    fixture.database.withTenant(tenantId, (client) =>
      isMachineControlEnabled(client, tenantId),
    );

  it('grants each role its Machine Control permissions', async () => {
    const all = [
      'mc.deliver',
      'mc.manage_devices',
      'mc.remote',
      'mc.upload',
      'mc.view',
    ];
    expect(await codesOf('Owner')).toEqual(all);
    expect(await codesOf('Organisation Admin')).toEqual(all);
    expect(await codesOf('Customer')).toEqual([
      'mc.deliver',
      'mc.manage_devices',
      'mc.upload',
      'mc.view',
    ]);
    expect(await codesOf('Technical Manager')).toEqual([
      'mc.deliver',
      'mc.upload',
      'mc.view',
    ]);
    expect(await codesOf('Field Technician')).toEqual(['mc.view']);
  });

  it('is off until the platform administrator turns it on, and back off', async () => {
    expect(await isOn(fixture.ids.customerTenant)).toBe(false);
    await admin.setEnabled(actors.owner, fixture.ids.customerTenant, true);
    expect(await isOn(fixture.ids.customerTenant)).toBe(true);

    const listed = await admin.listOrganisations(actors.owner, undefined);
    expect(
      listed.find((row) => row.id === fixture.ids.customerTenant),
    ).toMatchObject({ machineControlEnabled: true, activeMachineCount: 3 });

    await admin.setEnabled(actors.owner, fixture.ids.customerTenant, false);
    expect(await isOn(fixture.ids.customerTenant)).toBe(false);
  });

  it('refuses the switch to anyone but the platform administrator', async () => {
    await expect(
      admin.setEnabled(actors.adminA, fixture.ids.customerTenant, true),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      admin.listOrganisations(actors.adminA, undefined),
    ).rejects.toMatchObject({ status: 403 });
    expect(await isOn(fixture.ids.customerTenant)).toBe(false);
  });

  it('cancels waiting codes when it is turned off, so no tablet can pair', async () => {
    await admin.setEnabled(actors.owner, fixture.ids.customerTenant, true);
    const { code } = await pairing.createPairingCode(
      actors.adminA,
      world.shared1.id,
    );
    await admin.setEnabled(actors.owner, fixture.ids.customerTenant, false);
    await expect(pairing.pairDevice({ code: code! })).rejects.toMatchObject({
      status: 400,
    });
  });

  it('refuses the portal socket when it is off', async () => {
    await expect(
      pairing.assertMachineControlOn(actors.adminA),
    ).rejects.toMatchObject({ status: 403 });
    await admin.setEnabled(actors.owner, fixture.ids.customerTenant, true);
    await expect(
      pairing.assertMachineControlOn(actors.adminA),
    ).resolves.toBeUndefined();
  });

  it('lists connected tablets on machines the caller can see, only', async () => {
    const { code } = await pairing.createPairingCode(
      actors.adminA,
      world.shared1.id,
    );
    await pairing.pairDevice({ code: code!, serialNumber: 'TAB-1' });

    const mine = await devices.listDevices(actors.adminA);
    expect(mine.items).toHaveLength(1);
    expect(mine.items[0]).toMatchObject({
      serialNumber: 'TAB-1',
      online: false,
      machine: { id: world.shared1.id, label: 'PLANT-A1' },
    });
    expect(mine.connectableMachineCount).toBe(3);
    expect((await devices.listDevices(actors.techB)).items).toEqual([]);
  });
});
