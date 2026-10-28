import 'reflect-metadata';
import { Client, PoolClient } from 'pg';
import { buildPoolConfig } from '../src/database/buildPoolConfig';
import { readDatabaseUrl } from './dbTestConnection';
import { asTenantRole, insertTenant } from './isolationFixtures';
import * as fleet from '../src/machineFleet/machineFleet.repository';
import * as details from '../src/machineFleet/machineDetails.repository';
import * as assignments from '../src/machineAssignments/machineAssignments.repository';
import * as snapshots from '../src/machineConfiguration/snapshots.repository';
import { ListMachinesQueryDto } from '../src/machineFleet/dto/listMachinesQueryDto';

// The machine endpoints' new SQL (migration 0104) against a real database
// (npm run test:db), as the tenant role so RLS applies. Fixtures are
// written as the migration owner; everything is rolled back.

const client = new Client(buildPoolConfig(readDatabaseUrl()));
// The repositories take a pool client; a plain Client has the same query().
const db = client as unknown as PoolClient;

let tenantId: string;
let techId: string;
let machineA: string;
let machineB: string;

const insertReturningId = async (sql: string, params: unknown[]) =>
  (await client.query<{ id: string }>(sql, params)).rows[0].id;

const insertMachine = (modelId: string, makeId: string, serial: string) =>
  insertReturningId(
    `INSERT INTO machines (tenant_id, manufacturer_id, model_id, serial_number)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [tenantId, makeId, modelId, serial],
  );

const insertPhoto = (machineId: string, key: string, ageMinutes: number) =>
  insertReturningId(
    `INSERT INTO machine_photos (tenant_id, machine_id, storage_key, created_at)
     VALUES ($1, $2, $3, now() - make_interval(mins => $4)) RETURNING id`,
    [tenantId, machineId, key, ageMinutes],
  );

const listQuery = (overrides: Partial<ListMachinesQueryDto> = {}) =>
  Object.assign(new ListMachinesQueryDto(), overrides);

beforeAll(() => client.connect());
afterAll(() => client.end());

beforeEach(async () => {
  await client.query('BEGIN');
  tenantId = await insertTenant(client, 'machines');
  techId = await insertReturningId(
    `INSERT INTO users (tenant_id, email, first_name, last_name, cognito_sub)
     VALUES ($1, $2, 'Tess', 'Tech', $2) RETURNING id`,
    [tenantId, `machines-${Date.now()}@example.com`],
  );
  const makeId = await insertReturningId(
    'INSERT INTO machine_manufacturers (name) VALUES ($1) RETURNING id',
    [`Make ${Date.now()}`],
  );
  const modelId = await insertReturningId(
    `INSERT INTO machine_models (manufacturer_id, name) VALUES ($1, 'M1') RETURNING id`,
    [makeId],
  );
  machineA = await insertMachine(modelId, makeId, 'SN-A');
  machineB = await insertMachine(modelId, makeId, 'SN-B');
  await asTenantRole(client, tenantId);
});

afterEach(() => client.query('ROLLBACK'));

describe('machine photo', () => {
  it('uses the newest gallery photo, or the chosen cover', async () => {
    const older = await insertPhoto(machineA, 'photos/older.jpg', 60);
    await insertPhoto(machineA, 'photos/newer.jpg', 1);
    const photoKey = async () =>
      (await fleet.findFleetMachine(db, tenantId, machineA))!.photo_storage_key;
    expect(await photoKey()).toBe('photos/newer.jpg');
    await details.updateMachineDetails(db, {
      tenantId,
      machineId: machineA,
      change: { coverPhotoId: older, site: 'Pit 2', operatingHours: 1200 },
    });
    expect(await photoKey()).toBe('photos/older.jpg');
    expect(await details.findMachineDetails(db, tenantId, machineA)).toEqual({
      site: 'Pit 2',
      operating_hours: 1200,
      cover_photo_id: older,
    });
  });

  it('leaves fields that weren’t sent alone', async () => {
    await details.updateMachineDetails(db, {
      tenantId,
      machineId: machineA,
      change: { site: 'Pit 2' },
    });
    await details.updateMachineDetails(db, {
      tenantId,
      machineId: machineA,
      change: { operatingHours: 10 },
    });
    expect(await details.findMachineDetails(db, tenantId, machineA)).toEqual({
      site: 'Pit 2',
      operating_hours: 10,
      cover_photo_id: null,
    });
  });
});

describe('assigned technicians', () => {
  it('assigns once and filters the list to “assigned to me”', async () => {
    const assignment = { tenantId, machineId: machineB, userId: techId };
    expect(
      await assignments.insertAssignment(db, {
        ...assignment,
        assignedBy: techId,
      }),
    ).toBe(true);
    expect(
      await assignments.insertAssignment(db, {
        ...assignment,
        assignedBy: techId,
      }),
    ).toBe(false);
    const scope = { tenantId, viewerId: techId };
    const mine = await fleet.listMachines(
      db,
      scope,
      listQuery({ assignedToMe: true }),
    );
    expect(mine.map((row) => row.id)).toEqual([machineB]);
    expect(await fleet.countMachines(db, scope, listQuery())).toBe(2);
    expect(
      (await assignments.listAssignedTechnicians(db, tenantId, machineB)).map(
        (row) => row.id,
      ),
    ).toEqual([techId]);
    expect(await assignments.deleteAssignment(db, assignment)).toBe(true);
    expect(await assignments.deleteAssignment(db, assignment)).toBe(false);
  });
});

describe('restoring a snapshot', () => {
  it('puts recorded values back and reports unmatched components', async () => {
    const systemId = await insertReturningId(
      `INSERT INTO installed_systems (tenant_id, machine_id, name) VALUES ($1, $2, 'Engine') RETURNING id`,
      [tenantId, machineA],
    );
    const ecu = await insertReturningId(
      `INSERT INTO installed_components (tenant_id, installed_system_id, name, firmware_version)
       VALUES ($1, $2, 'ECU', 'v1') RETURNING id`,
      [tenantId, systemId],
    );
    await client.query(
      `INSERT INTO installed_components (tenant_id, installed_system_id, name) VALUES ($1, $2, 'Turbo')`,
      [tenantId, systemId],
    );
    const snapshotId = await snapshots.captureSnapshot(db, {
      machineId: machineA,
      takenBy: techId,
      trigger: 'manual',
    });
    await client.query(
      `UPDATE installed_components SET firmware_version = 'v2' WHERE id = $1`,
      [ecu],
    );
    await client.query(
      `UPDATE installed_components SET deleted_at = now() WHERE name = 'Turbo' AND installed_system_id = $1`,
      [systemId],
    );
    await client.query(
      `INSERT INTO installed_components (tenant_id, installed_system_id, name) VALUES ($1, $2, 'Filter')`,
      [tenantId, systemId],
    );
    const scope = { tenantId, machineId: machineA, snapshotId };
    expect(await snapshots.restoreSnapshotValues(db, scope)).toBe(1);
    const firmware = await client.query(
      'SELECT firmware_version FROM installed_components WHERE id = $1',
      [ecu],
    );
    expect(firmware.rows[0].firmware_version).toBe('v1');
    expect(await snapshots.listUnmatchedComponents(db, scope)).toEqual([
      { system_name: 'Engine', component_name: 'Filter', side: 'extra' },
      { system_name: 'Engine', component_name: 'Turbo', side: 'missing' },
    ]);
    await expect(
      snapshots.captureSnapshot(db, {
        machineId: machineA,
        takenBy: techId,
        trigger: 'restored',
      }),
    ).resolves.toEqual(expect.any(String));
  });
});
