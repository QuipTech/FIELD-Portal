import { MachineAppPairingService } from '../../src/machineControl/pairing/machineAppPairing.service';
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

// One code for one machine, used once; who can create it; and that a tablet
// ends up on the right machine, in the machine's own organisation.
describe('machine app pairing', () => {
  let fixture: BillingTestDatabase;
  let world: SharingWorld;
  let services: ReturnType<typeof servicesOf>;
  let actors: ReturnType<typeof actorsOf>;
  let pairing: MachineAppPairingService;

  beforeAll(async () => {
    fixture = await createBillingTestDatabase();
    services = servicesOf(fixture);
    pairing = new MachineAppPairingService(fixture.database);
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
  };
  const newCode = async (machineId: string) => {
    const result = await pairing.createPairingCode(actors.adminA, machineId);
    if (!result.code) throw new Error('Expected a code');
    return result.code;
  };

  it('creates a 6-digit code that lasts 15 minutes', async () => {
    const result = await pairing.createPairingCode(
      actors.adminA,
      world.shared1.id,
    );
    expect(result.code).toMatch(/^\d{6}$/);
    const minutes = (Date.parse(result.expiresAt!) - Date.now()) / 60000;
    expect(minutes).toBeGreaterThan(14);
    expect(minutes).toBeLessThanOrEqual(15);
  });

  it('connects the tablet to that machine only, and shows as connected', async () => {
    const code = await newCode(world.shared1.id);
    expect(
      await pairing.getConnection(actors.adminA, world.shared1.id),
    ).toEqual({ connected: false, device: null, session: null });

    const paired = await pairing.pairDevice({
      code,
      serialNumber: 'TAB-1',
      platform: 'android',
      appVersion: '1.0.0',
    });
    expect(paired.machine).toEqual({ id: world.shared1.id, label: 'PLANT-A1' });
    expect(paired.deviceToken.length).toBeGreaterThan(30);

    const connection = await pairing.getConnection(
      actors.techA,
      world.shared1.id,
    );
    expect(connection.connected).toBe(true);
    expect(connection.device).toMatchObject({
      serialNumber: 'TAB-1',
      platform: 'android',
    });
    expect(
      (await pairing.getConnection(actors.adminA, world.shared2.id)).connected,
    ).toBe(false);
  });

  it('stores only a hash of the token, in the owning organisation', async () => {
    const code = await newCode(world.shared1.id);
    const { deviceId, deviceToken } = await pairing.pairDevice({ code });
    const { rows } = await fixture.query(
      `SELECT tenant_id, token_hash FROM mc_device_credentials WHERE device_id = $1`,
      [deviceId],
    );
    expect(rows[0].tenant_id).toBe(fixture.ids.customerTenant);
    expect(rows[0].token_hash).not.toBe(deviceToken);
  });

  it('refuses a wrong, used, expired or replaced code', async () => {
    await expect(pairing.pairDevice({ code: '000000' })).rejects.toMatchObject({
      status: 400,
    });

    const used = await newCode(world.shared1.id);
    await pairing.pairDevice({ code: used });
    await expect(pairing.pairDevice({ code: used })).rejects.toMatchObject({
      status: 400,
    });

    const expired = await newCode(world.shared2.id);
    await fixture.query(
      `UPDATE mc_pairing_codes SET expires_at = now() - interval '1 minute' WHERE code = $1`,
      [expired],
    );
    await expect(pairing.pairDevice({ code: expired })).rejects.toMatchObject({
      status: 400,
    });

    const replaced = await newCode(world.private3.id);
    await newCode(world.private3.id);
    await expect(pairing.pairDevice({ code: replaced })).rejects.toMatchObject({
      status: 400,
    });
  });

  it('gives no new code to a connected machine until it is disconnected', async () => {
    const code = await newCode(world.shared1.id);
    await pairing.pairDevice({ code });
    expect(
      await pairing.createPairingCode(actors.adminA, world.shared1.id),
    ).toEqual({ connected: true });

    await pairing.disconnect(actors.adminA, world.shared1.id);
    expect(
      (await pairing.getConnection(actors.adminA, world.shared1.id)).connected,
    ).toBe(false);
    const { rows } = await fixture.query(
      `SELECT c.revoked_at FROM mc_device_credentials c
       JOIN mc_devices d ON d.id = c.device_id WHERE d.machine_id = $1`,
      [world.shared1.id],
    );
    expect(rows[0].revoked_at).not.toBeNull();
    await expect(
      pairing.disconnect(actors.adminA, world.shared1.id),
    ).rejects.toMatchObject({ status: 404 });
    await newCode(world.shared1.id);
  });

  it('keeps other organisations out', async () => {
    await expect(
      pairing.createPairingCode(actors.techB, world.private3.id),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      pairing.getConnection(actors.techB, world.private3.id),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      pairing.disconnect(actors.techB, world.private3.id),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("doesn't let a 'view' share connect", async () => {
    await shareWithB('view');
    await expect(
      pairing.createPairingCode(actors.techB, world.shared1.id),
    ).rejects.toMatchObject({ status: 403 });
    expect(
      (await pairing.getConnection(actors.techB, world.shared1.id)).connected,
    ).toBe(false);
  });

  it("lets a 'contribute' share connect, in the owning organisation", async () => {
    await shareWithB('contribute');
    const result = await pairing.createPairingCode(
      actors.techB,
      world.shared1.id,
    );
    expect(result.connected).toBe(false);
    const { rows } = await fixture.query(
      `SELECT tenant_id FROM mc_pairing_codes WHERE machine_id = $1 AND revoked_at IS NULL`,
      [world.shared1.id],
    );
    expect(rows[0].tenant_id).toBe(fixture.ids.customerTenant);
  });

  it('never lets the app role see or write codes and tokens directly', async () => {
    const code = await newCode(world.shared1.id);
    await pairing.pairDevice({ code });
    await newCode(world.shared2.id);
    const asAdmin = (sql: string): Promise<{ rows: unknown[] }> =>
      fixture.database.withActor(actors.adminA, async (client) => {
        const { rows } = await client.query(sql);
        return { rows };
      });
    expect((await asAdmin('SELECT * FROM mc_pairing_codes')).rows).toEqual([]);
    expect((await asAdmin('SELECT * FROM mc_device_credentials')).rows).toEqual(
      [],
    );
    await expect(
      asAdmin(
        `INSERT INTO mc_devices (tenant_id, machine_id)
         SELECT tenant_id, id FROM machines LIMIT 1`,
      ),
    ).rejects.toThrow();
  });
});
