import { MachineAppPairingService } from '../../src/machineControl/pairing/machineAppPairing.service';
import { DeviceSessionService } from '../../src/machineControl/session/deviceSession.service';
import {
  BillingTestDatabase,
  createBillingTestDatabase,
} from '../billing/billingTestDatabase';
import {
  actorsOf,
  seedSharingWorld,
  SharingWorld,
} from './machineSharingFixtures';
import {
  readMachineAppAnnouncements,
  recordMachineAppAnnouncements,
} from './machineAppAnnouncements';

// The live session after pairing: the token proves the tablet, refreshes,
// and stops working once either side ends it; 'pending' while a side is
// offline; every change is announced (machineAppAnnouncements.ts).
describe('machine app live session', () => {
  let fixture: BillingTestDatabase;
  let world: SharingWorld;
  let actors: ReturnType<typeof actorsOf>;
  let pairing: MachineAppPairingService;
  let sessions: DeviceSessionService;

  beforeAll(async () => {
    fixture = await createBillingTestDatabase();
    pairing = new MachineAppPairingService(fixture.database);
    sessions = new DeviceSessionService(fixture.database);
  });
  afterAll(() => fixture.db.close());
  beforeEach(async () => {
    await fixture.db.exec('BEGIN');
    world = await seedSharingWorld(fixture);
    actors = actorsOf(fixture, world);
    await recordMachineAppAnnouncements(fixture);
  });
  afterEach(() => fixture.db.exec('ROLLBACK'));

  const announced = () => readMachineAppAnnouncements(fixture);
  const lastAnnounced = async () => (await announced()).at(-1);

  // Pairing itself runs signed out, as it does for a real tablet.
  const pairTablet = async () => {
    const created = await pairing.createPairingCode(
      actors.adminA,
      world.shared1.id,
    );
    await fixture.query("SELECT set_config('app.user_id', '', true)");
    return pairing.pairDevice({ code: created.code!, platform: 'windows' });
  };

  it('knows the tablet by its token and describes the session', async () => {
    const { deviceToken, deviceId } = await pairTablet();
    const device = await sessions.authenticate(deviceToken);
    expect(await sessions.describe(device!)).toEqual({
      deviceId,
      machine: { id: world.shared1.id, label: 'PLANT-A1' },
      status: 'pending',
      tabletOnline: false,
      portalOnline: false,
    });
    expect(await sessions.authenticate('not-a-token')).toBeNull();
    expect(await announced()).toEqual([
      { event: 'session:started', reason: null },
    ]);
  });

  it('is active only while both sides are connected', async () => {
    const { deviceId } = await pairTablet();
    await sessions.setTabletOnline(deviceId, 'tablet-1', true);
    expect(await lastAnnounced()).toMatchObject({ status: 'pending' });

    await sessions.watch('portal-1', world.shared1.id);
    expect(await lastAnnounced()).toEqual({
      event: 'session:status',
      status: 'active',
      tabletOnline: true,
      portalOnline: true,
    });
    const connection = await pairing.getConnection(
      actors.adminA,
      world.shared1.id,
    );
    expect(connection.session?.status).toBe('active');

    // A second viewer, and one of two leaving, change nothing.
    const before = (await announced()).length;
    await sessions.watch('portal-2', world.shared1.id);
    await sessions.unwatch('portal-2', null);
    expect((await announced()).length).toBe(before);

    await sessions.unwatch('portal-1', null);
    expect(await lastAnnounced()).toMatchObject({
      status: 'pending',
      portalOnline: false,
    });
  });

  it('goes pending when the tablet drops, ignoring a stale old socket', async () => {
    const { deviceId } = await pairTablet();
    await sessions.watch('portal-1', world.shared1.id);
    await sessions.setTabletOnline(deviceId, 'old-socket', true);
    await sessions.setTabletOnline(deviceId, 'new-socket', true);
    await sessions.setTabletOnline(deviceId, 'old-socket', false);
    expect((await sessions.getState(world.shared1.id)).status).toBe('active');

    await sessions.setTabletOnline(deviceId, 'new-socket', false);
    expect(await lastAnnounced()).toMatchObject({
      status: 'pending',
      tabletOnline: false,
      portalOnline: true,
    });
  });

  it('swaps the token; the old one works for 5 more minutes only', async () => {
    const { deviceToken: oldToken } = await pairTablet();
    const { deviceToken: newToken } = await sessions.refreshToken(oldToken);
    expect(newToken).not.toBe(oldToken);
    expect(await sessions.authenticate(newToken)).not.toBeNull();
    expect(await sessions.authenticate(oldToken)).not.toBeNull();

    await fixture.query(
      `UPDATE mc_device_credentials SET revoked_at = now() - interval '1 second'
       WHERE revoked_at IS NOT NULL`,
    );
    expect(await sessions.authenticate(oldToken)).toBeNull();
    await expect(sessions.refreshToken(oldToken)).rejects.toMatchObject({
      status: 401,
      response: { code: 'DEVICE_TOKEN_REVOKED' },
    });
    expect(await sessions.authenticate(newToken)).not.toBeNull();
  });

  it('ends when the tablet removes itself, and tells the portal', async () => {
    const { deviceToken } = await pairTablet();
    await sessions.endSession(deviceToken);
    expect(await sessions.authenticate(deviceToken)).toBeNull();
    expect(
      (await pairing.getConnection(actors.adminA, world.shared1.id)).connected,
    ).toBe(false);
    expect(await lastAnnounced()).toEqual({
      event: 'session:ended',
      reason: 'tablet_disconnected',
    });
    await expect(sessions.endSession(deviceToken)).rejects.toMatchObject({
      status: 401,
    });
  });

  it('ends when the portal disconnects, including a refreshed token', async () => {
    const { deviceToken } = await pairTablet();
    const { deviceToken: newToken } = await sessions.refreshToken(deviceToken);
    await pairing.disconnect(actors.adminA, world.shared1.id);
    expect(await sessions.authenticate(deviceToken)).toBeNull();
    expect(await sessions.authenticate(newToken)).toBeNull();
    expect(await lastAnnounced()).toEqual({
      event: 'session:ended',
      reason: 'portal_disconnected',
    });
  });

  it('clears sockets of a dead container and ends long-offline sessions', async () => {
    const { deviceId, deviceToken } = await pairTablet();
    await sessions.setTabletOnline(deviceId, 'tablet-1', true);
    await sessions.watch('portal-1', world.shared1.id);
    await fixture.query(
      `UPDATE mc_devices SET last_seen_at = now() - interval '2 minutes'`,
    );
    await fixture.query(
      `UPDATE mc_portal_watchers SET last_seen_at = now() - interval '2 minutes'`,
    );
    expect(await sessions.sweep(90, 30)).toBe(0);
    expect(await sessions.getState(world.shared1.id)).toEqual({
      status: 'pending',
      tabletOnline: false,
      portalOnline: false,
    });
    expect(await sessions.authenticate(deviceToken)).not.toBeNull();

    await fixture.query(
      `UPDATE mc_devices SET last_seen_at = now() - interval '31 minutes'`,
    );
    expect(await sessions.sweep(90, 30)).toBe(1);
    expect(await sessions.authenticate(deviceToken)).toBeNull();
    expect(await lastAnnounced()).toEqual({
      event: 'session:ended',
      reason: 'connection_timeout',
    });
  });
});
