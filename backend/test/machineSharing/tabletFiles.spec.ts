import { randomUUID } from 'crypto';
import { hashToken } from '../../src/common/security/tokenHasher';
import { StorageService } from '../../src/storage/storage.service';
import { DeviceDesignDeliveryService } from '../../src/machineControl/designs/deviceDesignDelivery.service';
import { TabletFilesService } from '../../src/machineControl/designs/tabletFiles.service';
import { MachineHistoryService } from '../../src/machineHistory/machineHistory.service';
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
import { recordMachineAppAnnouncements } from './machineAppAnnouncements';

// "Send to tablet" (migration 0144): files sent to one machine's tablet as a
// design delivery, with a history entry that follows its status.
describe('send files to a tablet', () => {
  let fixture: BillingTestDatabase;
  let world: SharingWorld;
  let actors: ReturnType<typeof actorsOf>;
  let files: TabletFilesService;
  let tablet: DeviceDesignDeliveryService;
  let history: MachineHistoryService;
  let machineId: string;
  const token = 'device-token';
  const deleteFile = jest.fn().mockResolvedValue(undefined);
  const storage = {
    uploadMachineDesign: jest.fn(async () => ({ key: randomUUID() })),
    deleteFile,
    getSignedDownloadUrl: jest.fn(async () => ({ url: 'https://x.test/f' })),
  } as unknown as StorageService;

  beforeAll(async () => {
    fixture = await createBillingTestDatabase();
    files = new TabletFilesService(fixture.database, storage);
    tablet = new DeviceDesignDeliveryService(fixture.database, storage);
    history = new MachineHistoryService(fixture.database, storage);
  });
  afterAll(() => fixture.db.close());
  beforeEach(async () => {
    await fixture.db.exec('BEGIN');
    world = await seedSharingWorld(fixture);
    actors = actorsOf(fixture, world);
    machineId = world.shared1.id;
    await fixture.query(
      'UPDATE tenants SET machine_control_enabled = true WHERE id IN ($1, $2)',
      [fixture.ids.customerTenant, fixture.ids.setUpTenant],
    );
    await recordMachineAppAnnouncements(fixture);
  });
  afterEach(() => fixture.db.exec('ROLLBACK'));

  const pair = async () => {
    const deviceId = randomUUID();
    const tenantId = fixture.ids.customerTenant;
    await fixture.query(
      'INSERT INTO mc_devices (id, tenant_id, machine_id) VALUES ($1, $2, $3)',
      [deviceId, tenantId, machineId],
    );
    await fixture.query(
      'INSERT INTO mc_device_credentials (tenant_id, device_id, token_hash) VALUES ($1, $2, $3)',
      [tenantId, deviceId, hashToken(token)],
    );
    return { deviceId, tenantId, machineId, machineLabel: 'PLANT-A1' };
  };
  const file = (text: string) => ({
    buffer: Buffer.from(text),
    size: Buffer.byteLength(text),
    originalname: 'ignored',
    mimetype: 'application/octet-stream',
  });
  const dto = (...names: string[]) => ({
    sendId: randomUUID(),
    names: JSON.stringify(names),
  });
  const entries = () =>
    history.listHistory(actors.adminA, machineId, { type: 'file_transfer' });

  it('creates a delivery the tablet downloads, announces it and follows its status', async () => {
    const device = await pair();
    const request = dto('Übersicht.pdf', 'surface.xml');
    const upload = [file('data'), file('xml')];
    const sent = await files.send(actors.adminA, machineId, request, upload);
    expect(sent).toMatchObject({
      sendId: request.sendId,
      status: 'waiting',
      senderName: 'Ada Admin',
      files: [
        { name: 'Übersicht.pdf', sizeBytes: 4 },
        { name: 'surface.xml', sizeBytes: 3 },
      ],
    });
    // A retry returns the same send; other files can't reuse its ID.
    expect(
      await files.send(actors.adminA, machineId, request, upload),
    ).toMatchObject({ id: sent.id });
    await expect(
      files.send(actors.adminA, machineId, request, [file('a'), file('b')]),
    ).rejects.toMatchObject({ response: { code: 'tablet_send_id_reused' } });
    expect((await files.list(actors.adminA, machineId)).sends).toHaveLength(1);

    const { rows } = await fixture.query(
      "SELECT payload FROM test_announced WHERE payload->>'event' = 'design:available'",
    );
    expect(rows.map((row: { payload: unknown }) => row.payload)).toEqual([
      {
        event: 'design:available',
        deviceId: device.deviceId,
        machineId,
        deliveryId: sent.id,
      },
    ]);

    const { delivery } = await tablet.next(device, token);
    expect(delivery).toMatchObject({
      id: sent.id,
      project: 'Remote session files',
      status: 'waiting',
      files: [
        {
          path: 'Übersicht.pdf',
          sizeBytes: 4,
          sha256:
            '3a6eb0790f39ac87c94f3856b2dd2c5d110e6811602261a9a923d3bb23adc8b7',
        },
        { path: 'surface.xml', sizeBytes: 3 },
      ],
    });
    await tablet.update(device, token, sent.id, { status: 'downloading' });
    await tablet.update(device, token, sent.id, { status: 'arrived' });
    expect(await entries()).toMatchObject([
      {
        entryType: 'file_transfer',
        description:
          '2 files sent to the tablet\nÜbersicht.pdf (1 KB), surface.xml (1 KB)',
        author: { name: 'Ada Admin' },
        fileTransfer: { status: 'arrived', error: null },
      },
    ]);
  });

  it('shows a pending send as failed once the tablet is removed, and says why a new one is refused', async () => {
    await expect(
      files.send(actors.adminA, machineId, dto('a.txt'), [file('a')]),
    ).rejects.toMatchObject({
      status: 409,
      response: { code: 'machine_has_no_tablet' },
    });
    const device = await pair();
    await files.send(actors.adminA, machineId, dto('a.txt'), [file('a')]);
    await fixture.query(
      'UPDATE mc_devices SET disabled_at = now() WHERE id = $1',
      [device.deviceId],
    );
    expect(await entries()).toMatchObject([
      { fileTransfer: { status: 'failed' } },
    ]);
    await expect(
      files.send(actors.adminA, machineId, dto('b.txt'), [file('b')]),
    ).rejects.toMatchObject({
      status: 409,
      response: { code: 'tablet_removed' },
    });
  });

  it('needs contribute access and records the send in the owner history', async () => {
    await pair();
    const sender = {
      tenantId: fixture.ids.setUpTenant,
      userId: fixture.ids.setUpAdmin,
      email: 'admin@old.test',
    };
    const send = () =>
      files.send(sender, machineId, dto('a.txt'), [file('a')]);
    await expect(send()).rejects.toMatchObject({ status: 404 });

    const services = servicesOf(fixture);
    const group = await createSharedGroup(services, actors.owner, world);
    await services.assignments.grant(actors.owner, group.id, {
      targetType: 'organisation',
      targetId: sender.tenantId,
      accessLevel: 'view',
    });
    await expect(send()).rejects.toMatchObject({ status: 403 });
    await services.assignments.grant(actors.owner, group.id, {
      targetType: 'organisation',
      targetId: sender.tenantId,
      accessLevel: 'contribute',
    });
    expect(await send()).toMatchObject({ status: 'waiting' });
    expect(await entries()).toMatchObject([
      { fileTransfer: { status: 'waiting', files: [{ name: 'a.txt' }] } },
    ]);
  });

  it('enforces the limits and file names', async () => {
    await pair();
    const big = file('a'.repeat(5 * 1024 * 1024 + 1));
    const full = file('a'.repeat(5 * 1024 * 1024));
    const refused = (names: string[], upload: ReturnType<typeof file>[]) =>
      expect(
        files.send(actors.adminA, machineId, dto(...names), upload),
      ).rejects;
    await refused(['big.bin'], [big]).toMatchObject({
      response: { code: 'tablet_file_too_large' },
    });
    await refused(
      ['a', 'b', 'c', 'd', 'e'],
      [full, full, full, full, full],
    ).toMatchObject({ response: { code: 'tablet_send_too_large' } });
    for (const names of [['a.txt', 'A.TXT'], ['folder/a.txt'], ['CON.txt']]) {
      await refused(
        names,
        names.map(() => file('a')),
      ).toMatchObject({ response: { code: 'tablet_files_invalid' } });
    }
    await refused(['empty.txt'], [file('')]).toMatchObject({
      response: { code: 'tablet_files_invalid' },
    });
    expect((await files.list(actors.adminA, machineId)).sends).toEqual([]);
  });
});
