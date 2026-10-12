import { Client } from 'pg';
import { buildPoolConfig } from '../src/database/buildPoolConfig';
import { readDatabaseUrl } from './dbTestConnection';
import {
  DATA_SCHEMAS,
  SERVICE_ROLE,
  TENANT_ROLE,
  tableVisibilityLevel,
} from '../src/dataGovernance/dataSchemas.config';

// Runs against a real database (npm run test:db, see dbTestConnection) as
// the migration owner, so it can create fixtures and SET ROLE to the
// tenant and service roles. Every test runs inside a transaction that is
// rolled back — nothing is left behind.

const PERMISSION_DENIED = '42501';

const client = new Client(buildPoolConfig(readDatabaseUrl()));
let tenantA: string;
let tenantB: string;

const insertTenant = async (label: string): Promise<string> => {
  const slug = `isolation-test-${label}-${Date.now()}`;
  const result = await client.query<{ id: string }>(
    `INSERT INTO tenants (name, slug, status) VALUES ($1, $2, 'active') RETURNING id`,
    [`Isolation test ${label}`, slug],
  );
  return result.rows[0].id;
};

// One row per app table for the tenant, written as the migration owner.
const seedAppRows = async (tenantId: string) => {
  await client.query(
    `INSERT INTO app.subscriptions (tenant_id, tier, billing_basis) VALUES ($1, 'standard', 'per_asset')`,
    [tenantId],
  );
  await client.query('SELECT app.sync_entitlements($1)', [tenantId]);
  await client.query(
    `INSERT INTO app.billing_accounts (tenant_id, billing_email) VALUES ($1, 'billing@example.com')`,
    [tenantId],
  );
  await client.query(
    `INSERT INTO app.usage_events (tenant_id, event_type) VALUES ($1, 'ai_query')`,
    [tenantId],
  );
  await client.query(
    `INSERT INTO billing.stripe_customers (tenant_id, stripe_customer_id) VALUES ($1, $2)`,
    [tenantId, `cus_test_${tenantId}`],
  );
};

const asTenantRole = async (tenantId: string) => {
  await client.query(`SET LOCAL ROLE ${TENANT_ROLE}`);
  await client.query("SELECT set_config('app.tenant_id', $1, true)", [
    tenantId,
  ]);
};

const asServiceRole = () => client.query(`SET LOCAL ROLE ${SERVICE_ROLE}`);

// Runs a statement that must be refused; the savepoint keeps the
// surrounding transaction usable afterwards.
const expectRefused = async (sql: string, params: unknown[] = []) => {
  await client.query('SAVEPOINT refused');
  let code: string | undefined;
  try {
    await client.query(sql, params);
  } catch (error) {
    code = (error as { code?: string }).code;
  }
  await client.query('ROLLBACK TO SAVEPOINT refused');
  expect({ sql, code }).toEqual({ sql, code: PERMISSION_DENIED });
};

beforeAll(() => client.connect());
afterAll(() => client.end());

beforeEach(async () => {
  await client.query('BEGIN');
  tenantA = await insertTenant('a');
  tenantB = await insertTenant('b');
  await seedAppRows(tenantA);
  await seedAppRows(tenantB);
});

afterEach(() => client.query('ROLLBACK'));

describe('schemas match dataSchemas.config.ts', () => {
  it.each(DATA_SCHEMAS.map((schema) => [schema.name, schema] as const))(
    '%s has exactly the configured tables',
    async (_name, schema) => {
      const result = await client.query<{ table_name: string }>(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = $1 ORDER BY table_name`,
        [schema.name],
      );
      expect(result.rows.map((row) => row.table_name)).toEqual(
        [...schema.tables].sort(),
      );
    },
  );

  it.each(
    DATA_SCHEMAS.flatMap((schema) =>
      schema.tables.map(
        (table) =>
          [
            `${schema.name}.${table}`,
            tableVisibilityLevel(schema, table),
          ] as const,
      ),
    ),
  )('%s grants match its visibility level', async (qualified, level) => {
    const privileges = await client.query<Record<string, boolean>>(
      `SELECT has_table_privilege($1, $3, 'SELECT') AS tenant_select,
                has_table_privilege($1, $3, 'INSERT') OR has_table_privilege($1, $3, 'UPDATE')
                  OR has_table_privilege($1, $3, 'DELETE') AS tenant_write,
                has_table_privilege('public', $3, 'SELECT') AS public_select,
                has_table_privilege($2, $3, 'SELECT') AND has_table_privilege($2, $3, 'INSERT') AS service_rw,
                c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced
         FROM pg_class c WHERE c.oid = $3::regclass`,
      [TENANT_ROLE, SERVICE_ROLE, qualified],
    );
    const row = privileges.rows[0];
    expect(row.service_rw).toBe(true);
    expect(row.tenant_write).toBe(false);
    expect(row.public_select).toBe(false);
    expect(row.tenant_select).toBe(level !== 'service_role_only');
    if (level === 'own_rows_read_only')
      expect([row.rls_enabled, row.rls_forced]).toEqual([true, true]);
    if (level === 'service_role_only') expect(row.rls_enabled).toBe(false);
  });
});

describe('tenant role (field_app)', () => {
  it.each([
    'billing_accounts',
    'subscriptions',
    'entitlements',
    'usage_events',
  ])("sees only its own tenant's app.%s rows", async (table) => {
    await asTenantRole(tenantA);
    const result = await client.query<{ tenant_id: string }>(
      `SELECT DISTINCT tenant_id FROM app.${table} WHERE tenant_id IN ($1, $2)`,
      [tenantA, tenantB],
    );
    expect(result.rows.map((row) => row.tenant_id)).toEqual([tenantA]);
  });

  it('cannot read tenant B even when asking for it by id', async () => {
    await asTenantRole(tenantA);
    const result = await client.query(
      `SELECT * FROM app.subscriptions WHERE tenant_id = $1`,
      [tenantB],
    );
    expect(result.rowCount).toBe(0);
  });

  it('cannot insert, update or delete app rows — even its own', async () => {
    await asTenantRole(tenantA);
    await expectRefused(
      `INSERT INTO app.usage_events (tenant_id, event_type) VALUES ($1, 'ai_query')`,
      [tenantA],
    );
    await expectRefused(
      `UPDATE app.subscriptions SET tier = 'enterprise' WHERE tenant_id = $1`,
      [tenantA],
    );
    await expectRefused(`DELETE FROM app.entitlements WHERE tenant_id = $1`, [
      tenantA,
    ]);
  });

  it.each(['stripe_customers', 'stripe_invoices', 'stripe_webhook_log'])(
    'cannot read billing.%s at all',
    async (table) => {
      await asTenantRole(tenantA);
      await expectRefused(`SELECT 1 FROM billing.${table} LIMIT 1`);
    },
  );

  it('reads the plan catalogue but cannot change it', async () => {
    await asTenantRole(tenantA);
    const plans = await client.query('SELECT code FROM platform.plans');
    expect(plans.rowCount).toBeGreaterThan(0);
    await expectRefused(`UPDATE platform.plans SET name = 'x'`);
  });

  it('cannot read or add demo requests (sales leads)', async () => {
    await asTenantRole(tenantA);
    await expectRefused('SELECT 1 FROM platform.demo_requests LIMIT 1');
    await expectRefused(
      `INSERT INTO platform.demo_requests (email, first_name, last_name, company, country)
       VALUES ('a@example.com', 'A', 'B', 'C', 'AU')`,
    );
  });

  it('cannot change or delete audit log entries, or delete config snapshots', async () => {
    await asTenantRole(tenantA);
    await expectRefused(
      `UPDATE audit_logs SET action = 'update' WHERE tenant_id = $1`,
      [tenantA],
    );
    await expectRefused(`DELETE FROM audit_logs WHERE tenant_id = $1`, [
      tenantA,
    ]);
    await expectRefused(
      `DELETE FROM configuration_snapshots WHERE tenant_id = $1`,
      [tenantA],
    );
  });
});

describe('service role (field_service)', () => {
  it('reads billing and every tenant’s app rows', async () => {
    await asServiceRole();
    const customers = await client.query(
      `SELECT tenant_id FROM billing.stripe_customers WHERE tenant_id IN ($1, $2)`,
      [tenantA, tenantB],
    );
    expect(customers.rowCount).toBe(2);
    const subscriptions = await client.query(
      `SELECT tenant_id FROM app.subscriptions WHERE tenant_id IN ($1, $2)`,
      [tenantA, tenantB],
    );
    expect(subscriptions.rowCount).toBe(2);
  });
});

describe('usage metering triggers', () => {
  it('records seats and sessions without any application code', async () => {
    const user = await client.query<{ id: string }>(
      `INSERT INTO users (tenant_id, email, password_hash, first_name, last_name)
       VALUES ($1, $2, 'x', 'Iso', 'Test') RETURNING id`,
      [tenantA, `isolation-${Date.now()}@example.com`],
    );
    await client.query(
      `INSERT INTO sessions (tenant_id, user_id, refresh_token_hash, expires_at) VALUES ($1, $2, 'h', now() + interval '1 day')`,
      [tenantA, user.rows[0].id],
    );
    const events = await client.query<{ event_type: string }>(
      `SELECT event_type FROM app.usage_events WHERE tenant_id = $1 AND user_id = $2 ORDER BY event_type`,
      [tenantA, user.rows[0].id],
    );
    expect(events.rows.map((row) => row.event_type)).toEqual([
      'seat_added',
      'session_started',
    ]);
  });
});
