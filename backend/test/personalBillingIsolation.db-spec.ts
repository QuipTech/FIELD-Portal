import { Client } from 'pg';
import { buildPoolConfig } from '../src/database/buildPoolConfig';
import { readDatabaseUrl } from './dbTestConnection';
import {
  asServiceRole,
  asTenantRole,
  expectRefused,
  insertTenant,
} from './isolationFixtures';

const client = new Client(buildPoolConfig(readDatabaseUrl()));
interface PersonalFixture {
  tenantId: string;
  userId: string;
  accountId: string;
}
let first: PersonalFixture;
let colleague: PersonalFixture;
let outsider: PersonalFixture;

const seedPerson = async (
  tenantId: string,
  label: string,
): Promise<PersonalFixture> => {
  const user = await client.query<{ id: string }>(
    `INSERT INTO users (tenant_id, email, password_hash, first_name, last_name)
     VALUES ($1, $2, 'x', 'Personal', 'Test') RETURNING id`,
    [tenantId, `personal-${label}-${Date.now()}@example.com`],
  );
  const account = await client.query<{ id: string }>(
    `INSERT INTO billing.billing_accounts (name, billing_email)
     VALUES ($1, 'personal@example.com') RETURNING id`,
    [label],
  );
  const accountId = account.rows[0].id;
  const userId = user.rows[0].id;
  await client.query(
    `INSERT INTO billing.personal_accounts (tenant_id, user_id, billing_account_id)
     VALUES ($1, $2, $3)`,
    [tenantId, userId, accountId],
  );
  const invoice = await client.query<{ id: string }>(
    `INSERT INTO billing.invoices (billing_account_id, currency, total_ex_gst_cents)
     VALUES ($1, 'AUD', 4900) RETURNING id`,
    [accountId],
  );
  await client.query(
    `INSERT INTO billing.personal_periods
     (tenant_id, user_id, billing_account_id, price_book_id, period_start, period_end, invoice_id)
     SELECT $1, $2, $3, id, DATE '2026-10-01', DATE '2026-11-01', $4
     FROM billing.price_books WHERE plan_code = 'TECH' AND version = 1`,
    [tenantId, userId, accountId, invoice.rows[0].id],
  );
  return { tenantId, userId, accountId };
};

beforeAll(() => client.connect());
afterAll(() => client.end());
beforeEach(async () => {
  await client.query('BEGIN');
  const tenant = await insertTenant(client, 'personal-shared');
  first = await seedPerson(tenant, 'first');
  colleague = await seedPerson(tenant, 'colleague');
  outsider = await seedPerson(
    await insertTenant(client, 'personal-other'),
    'outsider',
  );
});
afterEach(() => client.query('ROLLBACK'));

describe('personal billing RLS', () => {
  it.each(['personal_accounts', 'personal_periods'])(
    'isolates billing.%s between users in the same tenant and other tenants',
    async (table) => {
      await asTenantRole(client, first.tenantId);
      await client.query("SELECT set_config('app.user_id', $1, true)", [
        first.userId,
      ]);
      const result = await client.query<{ user_id: string }>(
        `SELECT user_id FROM billing.${table}`,
      );
      expect(result.rows.map((row) => row.user_id)).toEqual([first.userId]);
    },
  );

  it('does not expose a colleague or an outsider by guessing their user id', async () => {
    await asTenantRole(client, first.tenantId);
    await client.query("SELECT set_config('app.user_id', $1, true)", [
      first.userId,
    ]);
    const result = await client.query(
      'SELECT id FROM billing.personal_periods WHERE user_id = ANY($1::uuid[])',
      [[colleague.userId, outsider.userId]],
    );
    expect(result.rowCount).toBe(0);
  });

  it('returns no personal rows when user context has not been set', async () => {
    await asTenantRole(client, first.tenantId);
    const result = await client.query(
      'SELECT id FROM billing.personal_accounts',
    );
    expect(result.rowCount).toBe(0);
  });

  it('denies client writes even to the current user’s period', async () => {
    await asTenantRole(client, first.tenantId);
    await client.query("SELECT set_config('app.user_id', $1, true)", [
      first.userId,
    ]);
    await expectRefused(
      client,
      'UPDATE billing.personal_periods SET period_end = period_end + 1 WHERE user_id = $1',
      [first.userId],
    );
  });

  it('allows the service role to find all three test accounts', async () => {
    await asServiceRole(client);
    const result = await client.query(
      'SELECT id FROM billing.personal_accounts WHERE user_id = ANY($1::uuid[])',
      [[first.userId, colleague.userId, outsider.userId]],
    );
    expect(result.rowCount).toBe(3);
  });
});
