import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';
// PGlite subpath typings use modern resolution; load its typed extension through Node here.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { pgcrypto } = require('@electric-sql/pglite/contrib/pgcrypto');
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { PoolClient } from 'pg';
import { DatabaseService } from '../../src/database/database.service';
import { ServiceDatabaseService } from '../../src/database/serviceDatabase.service';

// Every migration on an in-memory Postgres (PGlite). Fixtures that the
// billing backfill (0109) acts on are written just before it runs. Each
// spec wraps its tests in BEGIN/ROLLBACK, so the fixtures stay as created.

type Query = (
  sql: string,
  params?: unknown[],
) => Promise<{ rows: any[]; rowCount: number }>;

const BACKFILL_MIGRATION = '0109';

export const createBillingTestDatabase = async () => {
  const db = new PGlite({ extensions: { vector, pgcrypto } });
  await db.waitReady;
  const query: Query = async (sql, params = []) => {
    const result = await db.query(sql, params);
    return {
      rows: result.rows as any[],
      rowCount: Math.max(result.affectedRows ?? 0, result.rows.length),
    };
  };
  const directory = join(__dirname, '../../db/migrations');
  const migrations = readdirSync(directory)
    .filter((file) => file.endsWith('.sql'))
    .sort();
  const apply = async (files: string[]) => {
    for (const file of files)
      await db.exec(readFileSync(join(directory, file), 'utf8'));
  };
  try {
    await apply(migrations.filter((file) => file < BACKFILL_MIGRATION));

    const ids = {
      customerTenant: randomUUID(),
      platformTenant: randomUUID(),
      setUpTenant: randomUUID(),
      customerAdmin: randomUUID(),
      customerTech: randomUUID(),
      platformOwner: randomUUID(),
      setUpAdmin: randomUUID(),
    };
    await query(
      `INSERT INTO tenants(id,name,slug,status) VALUES
        ($1,'Pit Crew','pit-crew','active'),($2,'QuipTech','quiptech','active'),
        ($3,'Old Co','old-co','active')`,
      [ids.customerTenant, ids.platformTenant, ids.setUpTenant],
    );
    await query(
      `INSERT INTO users(id,tenant_id,email,first_name,last_name,password_hash) VALUES
        ($1,$2,'tech@pit.test','Terry','Tech','x'),
        ($3,$2,'admin@pit.test','Ada','Admin','x'),
        ($4,$5,'owner@quiptech.test','Quinn','Owner','x'),
        ($6,$7,'admin@old.test','Olive','Old','x')`,
      [
        ids.customerTech,
        ids.customerTenant,
        ids.customerAdmin,
        ids.platformOwner,
        ids.platformTenant,
        ids.setUpAdmin,
        ids.setUpTenant,
      ],
    );
    await query(
      `INSERT INTO user_roles(tenant_id,user_id,role_id)
       SELECT $1,$2,id FROM roles WHERE name='Organisation Admin' AND is_system_role`,
      [ids.customerTenant, ids.customerAdmin],
    );
    await query(
      `INSERT INTO user_roles(tenant_id,user_id,role_id)
       SELECT $1,$2,id FROM roles WHERE name='Owner' AND is_system_role`,
      [ids.platformTenant, ids.platformOwner],
    );
    // Set up by a platform admin before activation created a plan.
    const setUpAccount = await query(
      `SELECT admin_create_billing_account($1,'Old Co',NULL,'billing@old.test','Australia/Brisbane') AS id`,
      [ids.setUpTenant],
    );

    await apply(migrations.filter((file) => file >= BACKFILL_MIGRATION));

    // Runs work as a database role, with the request's organisation and
    // user set, inside a savepoint (the spec's transaction stays open).
    const asRole = async <T>(
      role: 'field_app' | 'field_service',
      context: { tenantId?: string; userId?: string },
      work: (client: PoolClient) => Promise<T>,
    ): Promise<T> => {
      await db.exec('SAVEPOINT as_role');
      await db.exec(`SET LOCAL ROLE ${role}`);
      await query(
        `SELECT set_config('app.tenant_id',$1,true),set_config('app.user_id',$2,true)`,
        [context.tenantId ?? '', context.userId ?? ''],
      );
      try {
        const result = await work({ query } as unknown as PoolClient);
        await db.exec('RESET ROLE; RELEASE SAVEPOINT as_role');
        return result;
      } catch (error) {
        await db.exec(
          'ROLLBACK TO SAVEPOINT as_role; RELEASE SAVEPOINT as_role',
        );
        throw error;
      }
    };
    const serviceDatabase = {
      query: (sql: string, params: unknown[] = []) =>
        asRole('field_service', {}, (client) => client.query(sql, params)),
      transaction: <T>(work: (client: PoolClient) => Promise<T>) =>
        asRole('field_service', {}, work),
    } as unknown as ServiceDatabaseService;
    const database = {
      query: (sql: string, params: unknown[] = []) => query(sql, params),
      withTenant: <T>(
        tenantId: string,
        work: (client: PoolClient) => Promise<T>,
      ) => asRole('field_app', { tenantId }, work),
      withActor: <T>(
        actor: { tenantId: string; userId: string },
        work: (client: PoolClient) => Promise<T>,
      ) => asRole('field_app', actor, work),
      transaction: <T>(work: (client: PoolClient) => Promise<T>) =>
        work({ query } as unknown as PoolClient),
    } as unknown as DatabaseService;

    // A registered machine in the organisation.
    const insertMachine = async (tenantId: string, serial = randomUUID()) => {
      const maker = await query(
        'INSERT INTO machine_manufacturers (name) VALUES ($1) RETURNING id',
        [`CAT ${serial}`],
      );
      const model = await query(
        `INSERT INTO machine_models (manufacturer_id, name) VALUES ($1, '793F') RETURNING id`,
        [maker.rows[0].id],
      );
      const machine = await query(
        `INSERT INTO machines (tenant_id, manufacturer_id, model_id, serial_number)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [tenantId, maker.rows[0].id, model.rows[0].id, serial],
      );
      return machine.rows[0].id as string;
    };

    return {
      db,
      query,
      asRole,
      insertMachine,
      serviceDatabase,
      database,
      ids: { ...ids, setUpAccount: setUpAccount.rows[0].id as string },
    };
  } catch (error) {
    await db.close();
    throw error;
  }
};

export type BillingTestDatabase = Awaited<
  ReturnType<typeof createBillingTestDatabase>
>;
