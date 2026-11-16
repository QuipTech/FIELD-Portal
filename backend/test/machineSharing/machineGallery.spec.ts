import { MachineGalleryService } from '../../src/machineHistory/machineGallery.service';
import { MachineDetailsService } from '../../src/machineFleet/machineDetails.service';
import { ListMachinesQueryDto } from '../../src/machineFleet/dto/listMachinesQueryDto';
import { MachineFleetService } from '../../src/machineFleet/machineFleet.service';
import { MACHINE_PHOTO_KEY_SQL } from '../../src/machineFleet/machineFleet.repository';
import { StorageService } from '../../src/storage/storage.service';
import { AuthenticatedUser } from '../../src/auth/types/authenticatedUser';
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

const jpg = {
  originalname: 'photo.jpg',
  mimetype: 'image/jpeg',
  size: 5,
  buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]),
};

// Who can remove a machine's gallery photos, and what happens to its cover.
describe('machine gallery photos', () => {
  let fixture: BillingTestDatabase;
  let world: SharingWorld;
  let services: ReturnType<typeof servicesOf>;
  let actors: ReturnType<typeof actorsOf>;
  let gallery: MachineGalleryService;
  let details: MachineDetailsService;
  let fleet: MachineFleetService;
  let uploads = 0;
  const storage = {
    uploadMachinePhoto: jest.fn(async (_file, tenantId, machineId) => {
      uploads += 1;
      return {
        key: `photos/${tenantId}/${machineId}/${uploads}-photo.jpg`,
        fileName: 'photo.jpg',
        contentType: 'image/jpeg',
        sizeBytes: 5,
        uploadedAt: new Date().toISOString(),
      };
    }),
    getSignedDownloadUrl: jest.fn(async (key: string) => ({
      url: `https://signed/${key}`,
      expiresAt: new Date().toISOString(),
    })),
    deleteFile: jest.fn(async () => undefined),
  };

  beforeAll(async () => {
    fixture = await createBillingTestDatabase();
    services = servicesOf(fixture);
    const signing = storage as unknown as StorageService;
    gallery = new MachineGalleryService(fixture.database, signing);
    details = new MachineDetailsService(fixture.database, signing);
    fleet = new MachineFleetService(fixture.database, signing);
  });
  afterAll(() => fixture.db.close());
  beforeEach(async () => {
    jest.clearAllMocks();
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
  const upload = (actor: AuthenticatedUser) =>
    gallery.uploadPhoto(actor, world.shared1.id, jpg, undefined);
  const shownPhotoKey = async () =>
    (
      await fixture.query(
        `SELECT ${MACHINE_PHOTO_KEY_SQL} AS key FROM machines m WHERE m.id = $1`,
        [world.shared1.id],
      )
    ).rows[0].key;
  const coverOf = async () =>
    (
      await fixture.query(`SELECT cover_photo_id FROM machines WHERE id = $1`, [
        world.shared1.id,
      ])
    ).rows[0].cover_photo_id;

  it('lets the owner delete any photo: gone from the list, row kept, audited', async () => {
    const saved = await upload(actors.adminA);
    await gallery.deletePhoto(actors.adminA, world.shared1.id, saved.id);

    expect(await gallery.listPhotos(actors.adminA, world.shared1.id)).toEqual(
      [],
    );
    const { rows } = await fixture.query(
      `SELECT deleted_at FROM machine_photos WHERE id = $1`,
      [saved.id],
    );
    expect(rows[0].deleted_at).not.toBeNull();
    expect(storage.deleteFile).not.toHaveBeenCalled();
    const audit = await fixture.query(
      `SELECT action FROM audit_logs WHERE entity_type = 'machine_gallery_photo' AND entity_id = $1`,
      [saved.id],
    );
    expect(audit.rows.map((row) => row.action).sort()).toEqual([
      'create',
      'delete',
    ]);
    await expect(
      gallery.deletePhoto(actors.adminA, world.shared1.id, saved.id),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("lets a 'contribute' share delete only its own uploads", async () => {
    const theirs = await upload(actors.adminA);
    await shareWithB('contribute');
    const own = await upload(actors.techB);

    const listed = await gallery.listPhotos(actors.techB, world.shared1.id);
    const canDelete = (id: string) =>
      listed.find((photo) => photo.id === id)?.canDelete;
    expect(canDelete(own.id)).toBe(true);
    expect(canDelete(theirs.id)).toBe(false);

    await gallery.deletePhoto(actors.techB, world.shared1.id, own.id);
    await expect(
      gallery.deletePhoto(actors.techB, world.shared1.id, theirs.id),
    ).rejects.toMatchObject({ status: 404 });
    const left = await gallery.listPhotos(actors.adminA, world.shared1.id);
    expect(left.map((photo) => photo.id)).toEqual([theirs.id]);
    expect(left[0].canDelete).toBe(true);
  });

  it("refuses delete from a 'view' share and from another organisation", async () => {
    const saved = await upload(actors.adminA);
    await expect(
      gallery.deletePhoto(actors.techB, world.shared1.id, saved.id),
    ).rejects.toMatchObject({ status: 404 });
    await shareWithB('view');
    await expect(
      gallery.deletePhoto(actors.techB, world.shared1.id, saved.id),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('flags the cover, and clears it when the owner deletes that photo', async () => {
    const older = await upload(actors.adminA);
    const newer = await upload(actors.adminA);
    await details.updateMachine(actors.adminA, world.shared1.id, {
      coverPhotoId: older.id,
    });
    const listed = await gallery.listPhotos(actors.adminA, world.shared1.id);
    expect(listed.map((photo) => [photo.id, photo.isCover])).toEqual([
      [older.id, true],
      [newer.id, false],
    ]);

    await gallery.deletePhoto(actors.adminA, world.shared1.id, older.id);

    expect(await coverOf()).toBeNull();
    const left = await gallery.listPhotos(actors.adminA, world.shared1.id);
    expect(left.map((photo) => photo.isCover)).toEqual([false]);
    expect(await shownPhotoKey()).toContain(newer.signedUrl.split('/').pop());
  });

  it('lets a contributor delete their own cover photo; the machine falls back to the newest', async () => {
    await shareWithB('contribute');
    const remaining = await upload(actors.adminA);
    const own = await upload(actors.techB);
    await details.updateMachine(actors.adminA, world.shared1.id, {
      coverPhotoId: own.id,
    });

    await gallery.deletePhoto(actors.techB, world.shared1.id, own.id);

    const left = await gallery.listPhotos(actors.adminA, world.shared1.id);
    expect(left.map((photo) => [photo.id, photo.isCover])).toEqual([
      [remaining.id, false],
    ]);
    expect(await shownPhotoKey()).toContain(
      remaining.signedUrl.split('/').pop(),
    );
  });

  it('takes a deleted photo off the metered storage', async () => {
    const saved = await upload(actors.adminA);
    await gallery.deletePhoto(actors.adminA, world.shared1.id, saved.id);
    const { rows } = await fixture.query(
      `SELECT quantity FROM app.usage_events
       WHERE subject_id = $1 AND event_type = 'storage.delta'`,
      [saved.id],
    );
    expect(rows.map((row) => Number(row.quantity)).sort()).toEqual([-5, 5]);
  });

  describe('on the machines list', () => {
    const rowOf = async (actor: AuthenticatedUser) => {
      const { items } = await fleet.listMachines(
        actor,
        new ListMachinesQueryDto(),
      );
      return items.find((machine) => machine.id === world.shared1.id);
    };
    const setPhotoType = (photoId: string, contentType: string) =>
      fixture.query(
        `UPDATE machine_photos SET content_type = $2 WHERE id = $1`,
        [photoId, contentType],
      );

    it('lists the cover then newest first, without deleted or HEIC photos', async () => {
      const first = await upload(actors.adminA);
      const second = await upload(actors.adminA);
      const third = await upload(actors.adminA);
      const deleted = await upload(actors.adminA);
      const heic = await upload(actors.adminA);
      await setPhotoType(heic.id, 'image/heic');
      await gallery.deletePhoto(actors.adminA, world.shared1.id, deleted.id);
      await details.updateMachine(actors.adminA, world.shared1.id, {
        coverPhotoId: first.id,
      });
      await fixture.query(
        `UPDATE machine_photos SET created_at = now() + (CASE id WHEN $1 THEN 1 WHEN $2 THEN 2 ELSE 0 END) * interval '1 minute'
         WHERE id IN ($1, $2)`,
        [second.id, third.id],
      );

      const row = await rowOf(actors.adminA);

      expect(row?.photoUrls).toEqual(
        [first, third, second].map((photo) => photo.signedUrl),
      );
    });

    it('caps the photos sent for one row', async () => {
      for (let count = 0; count < 12; count += 1) {
        await upload(actors.adminA);
      }
      expect((await rowOf(actors.adminA))?.photoUrls).toHaveLength(10);
    });

    it('shows a share its photos, as the gallery does', async () => {
      const saved = await upload(actors.adminA);
      await shareWithB('view');
      expect((await rowOf(actors.techB))?.photoUrls).toEqual([saved.signedUrl]);
    });

    it('gives an inactive machine no photo set, only its single photo', async () => {
      const saved = await upload(actors.adminA);
      await upload(actors.adminA);
      await fixture.query(
        `UPDATE machines SET lifecycle_state = 'registered' WHERE id = $1`,
        [world.shared1.id],
      );
      const row = await rowOf(actors.adminA);
      expect(row?.photoUrls).toEqual([]);
      expect(row?.photoUrl).toContain('https://signed/');
      expect(saved.signedUrl).toBeTruthy();
    });
  });
});
