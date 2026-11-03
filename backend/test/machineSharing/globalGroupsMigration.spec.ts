import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';
// PGlite subpath typings use modern resolution; load its typed extension through Node here.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { pgcrypto } = require('@electric-sql/pglite/contrib/pgcrypto');
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const FIRST_SHARING_MIGRATION = '0115';
const directory = join(__dirname, '../../db/migrations');
const migrations = readdirSync(directory)
  .filter((file) => file.endsWith('.sql'))
  .sort();

// Per-organisation groups (0113/0114) becoming global groups (0115-0118):
// the same rules the dry run on the dev database reported.
describe('global machine groups migration', () => {
  let db: PGlite;
  const one = async (sql: string, params: unknown[] = []) =>
    (await db.query<Record<string, unknown>>(sql, params)).rows[0];

  beforeAll(async () => {
    db = new PGlite({ extensions: { vector, pgcrypto } });
    for (const file of migrations.filter(
      (name) => name < FIRST_SHARING_MIGRATION,
    ))
      await db.exec(readFileSync(join(directory, file), 'utf8'));
    await db.exec(`
      INSERT INTO tenants (id, name, slug, status) VALUES
        ('11111111-1111-1111-1111-111111111111', 'TRT', 'trt', 'active'),
        ('22222222-2222-2222-2222-222222222222', 'Tovo solution', 'tovo', 'active');
      INSERT INTO users (id, tenant_id, email, first_name, last_name, password_hash, machine_access_mode) VALUES
        ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'sel@trt.test', 'Sel', 'Ected', 'x', 'selected'),
        ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'all@trt.test', 'Al', 'L', 'x', 'all');
      INSERT INTO machine_groups (id, tenant_id, name, notes) VALUES
        ('bbbbbbbb-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'QuipTech', 'North pit'),
        ('bbbbbbbb-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'quiptech', NULL),
        ('bbbbbbbb-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'ABC Earthmoving', NULL);
      INSERT INTO machine_groups (id, tenant_id, name, deleted_at) VALUES
        ('bbbbbbbb-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'Old', now());
      INSERT INTO machine_manufacturers (id, name) VALUES ('cccccccc-0000-0000-0000-000000000001', 'CAT');
      INSERT INTO machine_models (id, manufacturer_id, name) VALUES
        ('cccccccc-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000001', 'D10T');
      INSERT INTO machines (tenant_id, manufacturer_id, model_id, serial_number, group_id) VALUES
        ('11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000002', 'S1', 'bbbbbbbb-0000-0000-0000-000000000001'),
        ('11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000002', 'S2', 'bbbbbbbb-0000-0000-0000-000000000001'),
        ('22222222-2222-2222-2222-222222222222', 'cccccccc-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000002', 'S3', 'bbbbbbbb-0000-0000-0000-000000000002'),
        ('11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000002', 'S4', 'bbbbbbbb-0000-0000-0000-000000000004');
      INSERT INTO user_machine_group_access (tenant_id, user_id, group_id) VALUES
        ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001');
    `);
    for (const file of migrations.filter(
      (name) => name >= FIRST_SHARING_MIGRATION,
    ))
      await db.exec(readFileSync(join(directory, file), 'utf8'));
  });
  afterAll(() => db.close());

  it('keeps each live group by id, naming clashes after their organisation', async () => {
    const groups = await db.query<{
      id: string;
      name: string;
      description: string | null;
    }>(
      `SELECT id, name, description FROM machine_groups WHERE deleted_at IS NULL ORDER BY id`,
    );
    expect(groups.rows).toEqual([
      {
        id: 'bbbbbbbb-0000-0000-0000-000000000001',
        name: 'QuipTech (TRT)',
        description: 'North pit',
      },
      {
        id: 'bbbbbbbb-0000-0000-0000-000000000002',
        name: 'quiptech (Tovo solution)',
        description: null,
      },
      {
        id: 'bbbbbbbb-0000-0000-0000-000000000003',
        name: 'ABC Earthmoving',
        description: null,
      },
    ]);
  });

  it("copies each live group's machines, leaving deleted groups' out", async () => {
    const counts = await db.query<{ group_id: string; n: number }>(
      `SELECT group_id, count(*)::int AS n FROM machine_group_machines GROUP BY group_id ORDER BY group_id`,
    );
    expect(counts.rows).toEqual([
      { group_id: 'bbbbbbbb-0000-0000-0000-000000000001', n: 2 },
      { group_id: 'bbbbbbbb-0000-0000-0000-000000000002', n: 1 },
    ]);
  });

  it("makes 'selected' people 'groups_only' with a view assignment to each of their groups", async () => {
    expect(
      await one(
        `SELECT machine_access_mode FROM users WHERE email = 'sel@trt.test'`,
      ),
    ).toEqual({ machine_access_mode: 'groups_only' });
    expect(
      await one(
        `SELECT machine_access_mode FROM users WHERE email = 'all@trt.test'`,
      ),
    ).toEqual({ machine_access_mode: 'all' });
    const assignments = await db.query(
      `SELECT group_id, target_type, target_id, access_level FROM machine_group_assignments`,
    );
    expect(assignments.rows).toEqual([
      {
        group_id: 'bbbbbbbb-0000-0000-0000-000000000001',
        target_type: 'user',
        target_id: 'aaaaaaaa-0000-0000-0000-000000000001',
        access_level: 'view',
      },
    ]);
  });

  it('drops the per-organisation structure', async () => {
    expect(
      await one(`SELECT to_regclass('user_machine_group_access') AS t,
                        EXISTS (SELECT 1 FROM information_schema.columns
                                WHERE table_name = 'machines' AND column_name = 'group_id') AS has_group_id,
                        EXISTS (SELECT 1 FROM information_schema.columns
                                WHERE table_name = 'machine_groups' AND column_name = 'tenant_id') AS has_tenant_id`),
    ).toEqual({ t: null, has_group_id: false, has_tenant_id: false });
  });
});
