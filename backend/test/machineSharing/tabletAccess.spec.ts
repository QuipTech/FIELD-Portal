import { DeviceSessionService } from '../../src/machineControl/session/deviceSession.service';
import { MachineAppPairingService } from '../../src/machineControl/pairing/machineAppPairing.service';
import { KvsSignalingService } from '../../src/machineControl/remote/kvsSignaling.service';
import { RemoteRecordingService } from '../../src/machineControl/remote/remoteRecording.service';
import { RemoteSessionService } from '../../src/machineControl/remote/remoteSession.service';
import { TabletAccessService } from '../../src/machineControl/tablets/tabletAccess.service';
import { TabletCredentialsService } from '../../src/machineControl/tablets/tabletCredentials.service';
import {
  BillingTestDatabase,
  createBillingTestDatabase,
} from '../billing/billingTestDatabase';
import {
  actorsOf,
  seedSharingWorld,
  SharingWorld,
} from './machineSharingFixtures';
import { recordMachineAppAnnouncements } from './machineAppAnnouncements';

// Tablet access by FIELD ID and password (migration 0143): registering,
// adding to a machine, the lockout, unattended sessions and removal.
describe('tablet access by FIELD ID', () => {
  let fixture: BillingTestDatabase;
  let world: SharingWorld;
  let actors: ReturnType<typeof actorsOf>;
  let tablets: TabletAccessService;
  let devices: DeviceSessionService;
  let pairing: MachineAppPairingService;
  let remote: RemoteSessionService;
  const kvs = { requireEnabled: jest.fn(), isEnabled: () => true };
  const password = 'correct-horse';

  beforeAll(async () => {
    fixture = await createBillingTestDatabase();
    const credentials = new TabletCredentialsService(fixture.database);
    tablets = new TabletAccessService(fixture.database, credentials);
    devices = new DeviceSessionService(fixture.database);
    pairing = new MachineAppPairingService(fixture.database);
    remote = new RemoteSessionService(
      fixture.database,
      kvs as unknown as KvsSignalingService,
      {} as RemoteRecordingService,
      credentials,
    );
  });
  afterAll(() => fixture.db.close());
  beforeEach(async () => {
    await fixture.db.exec('BEGIN');
    world = await seedSharingWorld(fixture);
    actors = actorsOf(fixture, world);
    await fixture.query(
      'UPDATE tenants SET machine_control_enabled = true WHERE id IN ($1, $2)',
      [fixture.ids.customerTenant, fixture.ids.setUpTenant],
    );
    await recordMachineAppAnnouncements(fixture);
  });
  afterEach(() => fixture.db.exec('ROLLBACK'));

  const signedOut = () =>
    fixture.query("SELECT set_config('app.user_id', '', true)");

  const register = async () => {
    await signedOut();
    return tablets.register({ password, platform: 'windows' }, null);
  };

  const addedTablet = async (machineId = world.shared1.id) => {
    const registered = await register();
    await tablets.addToMachine(actors.adminA, machineId, {
      fieldId: registered.fieldId,
      password,
    });
    await signedOut();
    const session = await tablets.openSession(registered.tabletToken);
    await devices.setTabletOnline(session.deviceId, 'socket-1', true);
    return { ...registered, ...session };
  };

  it('registers a tablet that waits until someone adds it', async () => {
    const { fieldId, tabletToken } = await register();
    expect(fieldId).toMatch(/^[1-9]\d{8}$/);
    await expect(tablets.registration(tabletToken)).resolves.toEqual({
      fieldId,
      assigned: false,
      machine: null,
    });
    await expect(tablets.openSession(tabletToken)).rejects.toMatchObject({
      response: { code: 'tablet_not_assigned' },
    });
    const { rows } = await fixture.query(
      'SELECT password_hash FROM mc_tablets WHERE field_id = $1',
      [fieldId],
    );
    expect(rows[0].password_hash).not.toContain(password);
  });

  it('adds it to a machine and gives it a working device token', async () => {
    const tablet = await addedTablet();
    await expect(devices.authenticate(tablet.deviceToken)).resolves.toMatchObject({
      machineId: world.shared1.id,
    });
    await expect(
      pairing.getConnection(actors.adminA, world.shared1.id),
    ).resolves.toMatchObject({ device: { fieldId: tablet.fieldId } });
    await expect(
      tablets.changePassword(tablet.tabletToken, { password: 'another-one' }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('refuses another organisation, even with the right password', async () => {
    const tablet = await addedTablet();
    await expect(
      remote.connectByFieldId(actors.techB, { fieldId: tablet.fieldId, password }),
    ).rejects.toMatchObject({ response: { code: 'tablet_credentials_invalid' } });
    await pairing.disconnect(actors.adminA, world.shared1.id);
    await expect(
      tablets.addToMachine(actors.techB, world.ownB.id, {
        fieldId: tablet.fieldId,
        password,
      }),
    ).rejects.toMatchObject({ status: expect.any(Number) });
  });

  it('locks after five wrong passwords, and a reset unlocks', async () => {
    const tablet = await addedTablet();
    const connect = (attempt: string) =>
      remote.connectByFieldId(actors.adminA, {
        fieldId: tablet.fieldId,
        password: attempt,
      });
    for (let i = 0; i < 5; i += 1) {
      await expect(connect('wrong-password')).rejects.toMatchObject({ status: 400 });
    }
    await expect(connect(password)).rejects.toMatchObject({ status: 429 });
    await tablets.resetPassword(actors.adminA, world.shared1.id, {
      password: 'brand-new-password',
    });
    await expect(connect('brand-new-password')).resolves.toMatchObject({
      status: 'active',
    });
  });

  it('starts a session at once, with control or view only', async () => {
    const tablet = await addedTablet();
    const session = await remote.connectByFieldId(actors.adminA, {
      fieldId: tablet.fieldId,
      password,
      control: false,
    });
    expect(session).toMatchObject({
      machineId: world.shared1.id,
      status: 'active',
      access: 'unattended',
      scope: { control: false, record: true },
    });
    const { rows } = await fixture.query(
      "SELECT payload->>'event' AS event FROM test_announced WHERE payload->>'event' LIKE 'remote:%'",
    );
    expect(rows).toEqual([{ event: 'remote:accepted' }]);
    await expect(
      remote.create(actors.adminA, world.shared1.id, { password }),
    ).rejects.toMatchObject({ response: { code: 'remote_session_busy' } });
  });

  it("needs the password from the machine's page too", async () => {
    await addedTablet();
    await expect(
      remote.create(actors.adminA, world.shared1.id, {}),
    ).rejects.toMatchObject({ response: { code: 'remote_password_required' } });
    await expect(
      remote.create(actors.adminA, world.shared1.id, { password }),
    ).resolves.toMatchObject({ status: 'active', scope: { control: true } });
  });

  it('goes back to waiting when removed, keeping its FIELD ID', async () => {
    const tablet = await addedTablet();
    await pairing.disconnect(actors.adminA, world.shared1.id);
    await expect(devices.authenticate(tablet.deviceToken)).resolves.toBeNull();
    await expect(tablets.registration(tablet.tabletToken)).resolves.toMatchObject({
      fieldId: tablet.fieldId,
      assigned: false,
    });
    await tablets.addToMachine(actors.adminA, world.shared2.id, {
      fieldId: tablet.fieldId,
      password,
    });
    await expect(tablets.registration(tablet.tabletToken)).resolves.toMatchObject({
      machine: { id: world.shared2.id },
    });
  });

  it('gives a tablet paired with a code an ID without losing its machine', async () => {
    const code = await pairing.createPairingCode(actors.adminA, world.shared1.id);
    await signedOut();
    const paired = await pairing.pairDevice({ code: code.code!, platform: 'windows' });
    const registered = await tablets.register({ password }, paired.deviceToken);
    await expect(tablets.registration(registered.tabletToken)).resolves.toMatchObject({
      assigned: true,
      machine: { id: world.shared1.id },
    });
    await expect(devices.authenticate(paired.deviceToken)).resolves.not.toBeNull();
  });
});
