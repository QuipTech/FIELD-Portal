import { StorageService } from '../../src/storage/storage.service';
import { MachineDocumentsService } from '../../src/machineHistory/machineDocuments.service';
import { MachineHistoryService } from '../../src/machineHistory/machineHistory.service';
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

const pdf = {
  originalname: 'report.pdf',
  mimetype: 'application/pdf',
  size: 5,
  buffer: Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]),
};
const inspection = { documentType: 'inspection' as const };

// Who can add, read and remove a machine's documents, and how a file added
// with a history entry shows on the entry and on the Documents tab.
describe('machine documents', () => {
  let fixture: BillingTestDatabase;
  let world: SharingWorld;
  let services: ReturnType<typeof servicesOf>;
  let actors: ReturnType<typeof actorsOf>;
  let documents: MachineDocumentsService;
  let history: MachineHistoryService;
  const storage = {
    uploadMachineDocument: jest.fn(async (_file, tenantId, machineId) => ({
      key: `documents/${tenantId}/machines/${machineId}/report.pdf`,
      fileName: 'report.pdf',
      contentType: 'application/pdf',
      sizeBytes: 5,
      uploadedAt: new Date().toISOString(),
    })),
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
    documents = new MachineDocumentsService(fixture.database, signing);
    history = new MachineHistoryService(fixture.database, signing);
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
  const upload = (actor: AuthenticatedUser, machineId: string) =>
    documents.uploadDocument(actor, machineId, pdf, inspection);
  const addEntry = (actor: AuthenticatedUser, machineId: string) =>
    history.createEntry(actor, machineId, {
      entryType: 'inspection',
      description: 'Annual inspection',
    });

  it('lists an upload for its own organisation, with its uploader and type filter', async () => {
    await upload(actors.adminA, world.shared1.id);
    const [listed] = await documents.listDocuments(
      actors.techA,
      world.shared1.id,
      null,
    );
    expect(listed).toMatchObject({
      fileName: 'report.pdf',
      documentType: 'inspection',
      sizeBytes: 5,
      historyEntryId: null,
    });
    expect(listed.uploadedByName).toBeTruthy();
    expect(listed.signedUrl).toContain('https://signed/');
    expect(
      await documents.listDocuments(
        actors.techA,
        world.shared1.id,
        'certificate',
      ),
    ).toEqual([]);
  });

  describe('in every lifecycle state', () => {
    const setState = (machineId: string, state: string) =>
      fixture.query(`UPDATE machines SET lifecycle_state = $2 WHERE id = $1`, [
        machineId,
        state,
      ]);

    it.each(['registered', 'archived'])(
      'adds, lists and deletes on a %s machine',
      async (state) => {
        await setState(world.shared1.id, state);
        const saved = await upload(actors.adminA, world.shared1.id);
        expect(
          await documents.listDocuments(actors.techA, world.shared1.id, null),
        ).toHaveLength(1);
        await documents.deleteDocument(
          actors.adminA,
          world.shared1.id,
          saved.id,
        );
        expect(
          await documents.listDocuments(actors.techA, world.shared1.id, null),
        ).toHaveLength(0);
      },
    );

    it("keeps a sold machine's documents readable but unchanged", async () => {
      const saved = await upload(actors.adminA, world.shared1.id);
      await setState(world.shared1.id, 'sold');
      storage.uploadMachineDocument.mockClear();

      expect(
        await documents.listDocuments(actors.techA, world.shared1.id, null),
      ).toHaveLength(1);
      await expect(
        upload(actors.adminA, world.shared1.id),
      ).rejects.toMatchObject({ status: 403 });
      expect(storage.uploadMachineDocument).not.toHaveBeenCalled();
      await expect(
        documents.deleteDocument(actors.adminA, world.shared1.id, saved.id),
      ).rejects.toMatchObject({ status: 403 });
    });
  });

  it('keeps another organisation out', async () => {
    await upload(actors.adminA, world.private3.id);
    await expect(
      documents.listDocuments(actors.techB, world.private3.id, null),
    ).rejects.toMatchObject({ status: 404 });
    await expect(upload(actors.techB, world.private3.id)).rejects.toMatchObject(
      { status: 404 },
    );
    expect(storage.uploadMachineDocument).toHaveBeenCalledTimes(1);
  });

  it("lets a 'view' share read but not upload", async () => {
    await upload(actors.adminA, world.shared1.id);
    await shareWithB('view');
    expect(
      await documents.listDocuments(actors.techB, world.shared1.id, null),
    ).toHaveLength(1);
    await expect(upload(actors.techB, world.shared1.id)).rejects.toMatchObject({
      status: 403,
    });
  });

  it("stores a 'contribute' upload in the owning organisation", async () => {
    await shareWithB('contribute');
    await upload(actors.techB, world.shared1.id);
    expect(storage.uploadMachineDocument).toHaveBeenCalledWith(
      pdf,
      fixture.ids.customerTenant,
      world.shared1.id,
    );
    const { rows } = await fixture.query(
      `SELECT tenant_id, uploaded_by FROM machine_documents WHERE machine_id = $1`,
      [world.shared1.id],
    );
    expect(rows).toEqual([
      { tenant_id: fixture.ids.customerTenant, uploaded_by: world.techB },
    ]);
  });

  it("stops a share attaching to someone else's entry and from deleting", async () => {
    const theirs = await addEntry(actors.adminA, world.shared1.id);
    const saved = await upload(actors.adminA, world.shared1.id);
    await shareWithB('contribute');
    await expect(
      documents.uploadDocument(actors.techB, world.shared1.id, pdf, {
        ...inspection,
        historyEntryId: theirs.id,
      }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      documents.deleteDocument(actors.techB, world.shared1.id, saved.id),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("lets a 'contribute' share delete only its own uploads", async () => {
    const theirs = await upload(actors.adminA, world.shared1.id);
    await shareWithB('contribute');
    const own = await upload(actors.techB, world.shared1.id);

    const listed = await documents.listDocuments(
      actors.techB,
      world.shared1.id,
      null,
    );
    const canDelete = (id: string) =>
      listed.find((document) => document.id === id)?.canDelete;
    expect(canDelete(own.id)).toBe(true);
    expect(canDelete(theirs.id)).toBe(false);

    await documents.deleteDocument(actors.techB, world.shared1.id, own.id);
    await expect(
      documents.deleteDocument(actors.techB, world.shared1.id, theirs.id),
    ).rejects.toMatchObject({ status: 404 });
    const left = await documents.listDocuments(
      actors.adminA,
      world.shared1.id,
      null,
    );
    expect(left.map((document) => document.id)).toEqual([theirs.id]);
    expect(left[0].canDelete).toBe(true);
  });

  it("refuses delete from a 'view' share", async () => {
    const saved = await upload(actors.adminA, world.shared1.id);
    await shareWithB('view');
    await expect(
      documents.deleteDocument(actors.techB, world.shared1.id, saved.id),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('soft deletes: gone from the list, row kept, audited', async () => {
    const saved = await upload(actors.adminA, world.shared1.id);
    await documents.deleteDocument(actors.adminA, world.shared1.id, saved.id);
    expect(
      await documents.listDocuments(actors.adminA, world.shared1.id, null),
    ).toEqual([]);
    const { rows } = await fixture.query(
      `SELECT deleted_at FROM machine_documents WHERE id = $1`,
      [saved.id],
    );
    expect(rows[0].deleted_at).not.toBeNull();
    const audit = await fixture.query(
      `SELECT action FROM audit_logs WHERE entity_type = 'machine_document' AND entity_id = $1 ORDER BY created_at`,
      [saved.id],
    );
    expect(audit.rows.map((row) => row.action).sort()).toEqual([
      'create',
      'delete',
    ]);
    await expect(
      documents.deleteDocument(actors.adminA, world.shared1.id, saved.id),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('refuses an entry from another machine, before storing the file', async () => {
    const other = await addEntry(actors.adminA, world.shared2.id);
    await expect(
      documents.uploadDocument(actors.adminA, world.shared1.id, pdf, {
        ...inspection,
        historyEntryId: other.id,
      }),
    ).rejects.toMatchObject({ status: 404 });
    expect(storage.uploadMachineDocument).not.toHaveBeenCalled();
  });

  it('shows a file added with an entry on both the entry and the tab', async () => {
    const entry = await addEntry(actors.adminA, world.shared1.id);
    await documents.uploadDocument(actors.adminA, world.shared1.id, pdf, {
      ...inspection,
      historyEntryId: entry.id,
    });
    const listed = await history.listHistory(
      actors.adminA,
      world.shared1.id,
      {},
    );
    const saved = listed.find((item) => item.id === entry.id);
    expect(saved?.documents.map((file) => file.fileName)).toEqual([
      'report.pdf',
    ]);
    const [onTab] = await documents.listDocuments(
      actors.adminA,
      world.shared1.id,
      null,
    );
    expect(onTab.historyEntryId).toBe(entry.id);
  });
});
