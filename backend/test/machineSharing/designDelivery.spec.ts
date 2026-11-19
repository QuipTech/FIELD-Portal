import { randomUUID } from 'crypto';
import {
  BillingTestDatabase,
  createBillingTestDatabase,
} from '../billing/billingTestDatabase';
import { hashToken } from '../../src/common/security/tokenHasher';
import { StorageService } from '../../src/storage/storage.service';
import { DesignLibraryService } from '../../src/machineControl/designs/designLibrary.service';
import { DeviceDesignDeliveryService } from '../../src/machineControl/designs/deviceDesignDelivery.service';

import {
  actorsOf,
  createSharedGroup,
  seedSharingWorld,
  servicesOf,
} from './machineSharingFixtures';

describe('design delivery', () => {
  let test: BillingTestDatabase;

  beforeAll(async () => {
    test = await createBillingTestDatabase();
  }, 60_000);
  afterAll(async () => test?.db.close());

  it('delivers a site version to its pairing, records arrival and can resend an older version', async () => {
    const { query, ids } = test;
    const tenantId = ids.customerTenant;
    const actor = {
      userId: ids.customerAdmin,
      tenantId,
      email: 'admin@pit.test',
    };
    const machineId = await test.insertMachine(tenantId);
    const deviceId = randomUUID();
    const token = randomUUID();
    const device = { deviceId, tenantId, machineId, machineLabel: 'Machine' };
    await query(
      'UPDATE tenants SET machine_control_enabled = true WHERE id = $1',
      [tenantId],
    );
    await query(
      "UPDATE machines SET lifecycle_state = 'active', site = 'Pit' WHERE id = $1",
      [machineId],
    );
    await query(
      'INSERT INTO mc_devices (id, tenant_id, machine_id) VALUES ($1, $2, $3)',
      [deviceId, tenantId, machineId],
    );
    await query(
      'INSERT INTO mc_device_credentials (tenant_id, device_id, token_hash) VALUES ($1, $2, $3)',
      [tenantId, deviceId, hashToken(token)],
    );

    const storage = {
      uploadMachineDesign: jest
        .fn()
        .mockImplementation(async () => ({ key: randomUUID() })),
      getSignedDownloadUrl: jest
        .fn()
        .mockResolvedValue({ url: 'https://example.test/design' }),
    } as unknown as StorageService;
    const library = new DesignLibraryService(test.database, storage);
    const tablet = new DeviceDesignDeliveryService(test.database, storage);
    const upload = (path: string) =>
      library.upload(
        actor,
        { project: 'North', paths: JSON.stringify([path]) },
        [
          {
            buffer: Buffer.from('data'),
            size: 4,
            originalname: 'design.dxf',
            mimetype: 'application/octet-stream',
          },
        ],
      );
    await query('BEGIN');
    try {
      const first = await upload('surfaces/old.dxf');
      const second = await upload('surfaces/new.dxf');
      const request = {
        versionId: second.id,
        site: 'Pit',
        siteTenantId: tenantId,
      };
      const preview = await library.preview(actor, request);
      expect(preview.targets).toMatchObject([{ machineId, replaces: null }]);
      const send = {
        ...request,
        previewHash: preview.previewHash,
        batchId: randomUUID(),
      };
      await library.send(actor, send);
      await library.send(actor, send);
      expect((await library.list(actor)).deliveries).toHaveLength(1);

      const { delivery } = await tablet.next(device, token);
      expect(delivery).toMatchObject({
        versionId: second.id,
        status: 'waiting',
        files: [{ path: 'surfaces/new.dxf', sizeBytes: 4 }],
      });
      expect(delivery!.files[0]).not.toHaveProperty('key');
      await expect(
        tablet.next({ ...device, deviceId: randomUUID() }, token),
      ).rejects.toMatchObject({ status: 401 });
      await tablet.update(device, token, delivery!.id, {
        status: 'downloading',
      });
      await expect(
        tablet.download(device, token, delivery!.id, 0),
      ).resolves.toHaveProperty('url');
      await tablet.update(device, token, delivery!.id, { status: 'arrived' });
      await tablet.update(device, token, delivery!.id, { status: 'arrived' });
      expect(await tablet.next(device, token)).toEqual({ delivery: null });
      expect((await library.list(actor)).deliveries).toMatchObject([
        { status: 'arrived' },
      ]);

      const rollback = { versionId: first.id, machineIds: [machineId] };
      const rollbackPreview = await library.preview(actor, rollback);
      expect(rollbackPreview.targets).toMatchObject([
        { replaces: { versionId: second.id, paths: ['surfaces/new.dxf'] } },
      ]);
      await library.send(actor, {
        ...rollback,
        previewHash: rollbackPreview.previewHash,
        batchId: randomUUID(),
      });
      expect((await tablet.next(device, token)).delivery?.versionId).toBe(
        first.id,
      );
    } finally {
      await query('ROLLBACK');
    }
  });

  it('lets a contribute share send across organisations and keeps the library private', async () => {
    const { query, ids } = test;
    const tenantId = ids.customerTenant;
    await query('BEGIN');
    try {
      const world = await seedSharingWorld(test);
      const actors = actorsOf(test, world);
      const services = servicesOf(test);
      const group = await createSharedGroup(services, actors.owner, world);
      const machineId = world.shared1.id;
      const deviceId = randomUUID();
      const token = randomUUID();
      const device = {
        deviceId,
        tenantId,
        machineId,
        machineLabel: 'PLANT-A1',
      };
      await query(
        'UPDATE tenants SET machine_control_enabled = true WHERE id IN ($1, $2)',
        [tenantId, ids.setUpTenant],
      );
      await query(
        'INSERT INTO mc_devices (id, tenant_id, machine_id) VALUES ($1, $2, $3)',
        [deviceId, tenantId, machineId],
      );
      await query(
        'INSERT INTO mc_device_credentials (tenant_id, device_id, token_hash) VALUES ($1, $2, $3)',
        [tenantId, deviceId, hashToken(token)],
      );

      const storage = {
        uploadMachineDesign: jest.fn().mockResolvedValue({ key: 'design-key' }),
      } as unknown as StorageService;
      const library = new DesignLibraryService(test.database, storage);
      const tablet = new DeviceDesignDeliveryService(test.database, storage);
      const sender = {
        tenantId: ids.setUpTenant,
        userId: ids.setUpAdmin,
        email: 'admin@old.test',
      };
      const version = await library.upload(
        sender,
        { project: 'Shared', paths: '["surface.xml"]' },
        [
          {
            buffer: Buffer.from('xml'),
            size: 3,
            originalname: 'surface.xml',
            mimetype: 'application/xml',
          },
        ],
      );
      const request = { machineIds: [machineId], versionId: version.id };
      await expect(library.preview(sender, request)).rejects.toMatchObject({
        status: 400,
      });

      await services.assignments.grant(actors.owner, group.id, {
        targetType: 'organisation',
        targetId: sender.tenantId,
        accessLevel: 'contribute',
      });
      const preview = await library.preview(sender, request);
      await library.send(sender, {
        ...request,
        previewHash: preview.previewHash,
        batchId: randomUUID(),
      });
      expect((await tablet.next(device, token)).delivery).toMatchObject({
        versionId: version.id,
      });
      const recipient = await library.list(actors.adminA);
      expect(recipient.versions).toEqual([]);
      expect(recipient.deliveries).toMatchObject([
        { project: 'Shared', status: 'waiting' },
      ]);
      await expect(
        library.download(actors.adminA, version.id, 0),
      ).rejects.toMatchObject({ status: 404 });
    } finally {
      await query('ROLLBACK');
    }
  });

  it('rejects paths that escape or conflict on the Windows filesystem', async () => {
    const actor = {
      tenantId: test.ids.customerTenant,
      userId: test.ids.customerAdmin,
      email: '',
    };
    const library = new DesignLibraryService(
      test.database,
      {} as StorageService,
    );
    const file = {
      buffer: Buffer.alloc(1),
      size: 1,
      originalname: 'data',
      mimetype: 'application/octet-stream',
    };
    for (const paths of [
      ['../config'],
      ['a/COM1.cfg'],
      ['data/x', 'DATA/y'],
      ['folder', 'folder/file'],
    ]) {
      await expect(
        library.upload(
          actor,
          { project: 'Design', paths: JSON.stringify(paths) },
          paths.map(() => file),
        ),
      ).rejects.toMatchObject({ status: 400 });
    }
  });
});
