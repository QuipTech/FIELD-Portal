import { MachineIdentifiersService } from '../../src/machineFleet/machineIdentifiers.service';
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

// The platform administrator corrects another organisation's machine (Plant
// ID, serial, site) from the machine page; customers still can't.
describe("correcting another organisation's machine", () => {
  let fixture: BillingTestDatabase;
  let world: SharingWorld;
  let services: ReturnType<typeof servicesOf>;
  let actors: ReturnType<typeof actorsOf>;
  let identifiers: MachineIdentifiersService;

  beforeAll(async () => {
    fixture = await createBillingTestDatabase();
    services = servicesOf(fixture);
    identifiers = new MachineIdentifiersService(fixture.database);
  });
  afterAll(() => fixture.db.close());
  beforeEach(async () => {
    await fixture.db.exec('BEGIN');
    world = await seedSharingWorld(fixture);
    actors = actorsOf(fixture, world);
    // Shared with the platform's organisation and with Set Up.
    const group = await createSharedGroup(services, actors.owner, world);
    for (const targetId of [
      fixture.ids.platformTenant,
      fixture.ids.setUpTenant,
    ]) {
      await services.assignments.grant(actors.owner, group.id, {
        targetType: 'organisation',
        targetId,
        accessLevel: 'contribute',
      });
    }
  });
  afterEach(() => fixture.db.exec('ROLLBACK'));

  const machineRow = async () =>
    (
      await fixture.query(
        `SELECT serial_number, asset_number, site FROM machines WHERE id = $1`,
        [world.shared1.id],
      )
    ).rows[0];
  const ownerAudit = async (entityType: string) =>
    (
      await fixture.query(
        `SELECT metadata FROM audit_logs
         WHERE tenant_id = $1 AND entity_type = $2 AND entity_id = $3`,
        [fixture.ids.customerTenant, entityType, world.shared1.id],
      )
    ).rows;

  it('lets the platform administrator correct the Plant ID and serial, audited for the owner', async () => {
    const result = await identifiers.correctIdentifiers(
      actors.owner,
      world.shared1.id,
      { assetNumber: 'DZ-900', serialNumber: 'SER-900', reason: 'Plate photo' },
    );

    expect(result).toMatchObject({
      assetNumber: 'DZ-900',
      serialNumber: 'SER-900',
    });
    expect(await machineRow()).toMatchObject({
      asset_number: 'DZ-900',
      serial_number: 'SER-900',
    });
    const [entry] = await ownerAudit('machine_identifiers');
    expect(entry.metadata).toMatchObject({
      reason: 'Plate photo',
      byPlatformAdmin: true,
      to: { assetNumber: 'DZ-900', serialNumber: 'SER-900' },
    });
  });

  it('lets the platform administrator correct the site, and nothing else', async () => {
    await services.details.updateMachine(actors.owner, world.shared1.id, {
      site: 'Burton',
    });
    expect((await machineRow()).site).toBe('Burton');
    expect(await ownerAudit('machine')).toHaveLength(1);

    await fixture.db.exec('SAVEPOINT hours');
    await expect(
      services.details.updateMachine(actors.owner, world.shared1.id, {
        operatingHours: 10,
      }),
    ).rejects.toMatchObject({ status: 404 });
    await fixture.db.exec('ROLLBACK TO SAVEPOINT hours');
  });

  it('refuses a blank serial and other identifiers', async () => {
    await fixture.db.exec('SAVEPOINT blank');
    await expect(
      identifiers.correctIdentifiers(actors.owner, world.shared1.id, {
        serialNumber: ' ',
        reason: 'Oops',
      }),
    ).rejects.toMatchObject({ status: 400 });
    await fixture.db.exec('ROLLBACK TO SAVEPOINT blank');
    await expect(
      identifiers.correctIdentifiers(actors.owner, world.shared1.id, {
        fleetNumber: 'F-1',
        reason: 'Fleet',
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('still refuses a customer with a contribute share', async () => {
    const before = await machineRow();
    await fixture.db.exec('SAVEPOINT customer');
    await expect(
      identifiers.correctIdentifiers(actors.techB, world.shared1.id, {
        assetNumber: 'MINE',
        reason: 'Mine now',
      }),
    ).rejects.toMatchObject({ status: 404 });
    await fixture.db.exec('ROLLBACK TO SAVEPOINT customer');
    await fixture.db.exec('SAVEPOINT customer_site');
    await expect(
      services.details.updateMachine(actors.techB, world.shared1.id, {
        site: 'Their pit',
      }),
    ).rejects.toMatchObject({ status: 404 });
    await fixture.db.exec('ROLLBACK TO SAVEPOINT customer_site');
    expect(await machineRow()).toEqual(before);
  });

  it("keeps the owner's own edits working as before", async () => {
    const result = await identifiers.correctIdentifiers(
      actors.adminA,
      world.shared1.id,
      { assetNumber: 'OWN-1', reason: 'Renumbered' },
    );
    expect(result.assetNumber).toBe('OWN-1');
  });
});
