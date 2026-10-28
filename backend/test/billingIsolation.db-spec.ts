import { Client } from 'pg';
import { buildPoolConfig } from '../src/database/buildPoolConfig';
import { readDatabaseUrl } from './dbTestConnection';
import {
  asServiceRole,
  asTenantRole,
  expectRefused,
  insertTenant,
} from './isolationFixtures';

// Billing RLS (migration 0096): an organisation reads its own billing
// account's rows and nothing of any other account, and can't write any of
// them. Runs against a real database (npm run test:db), rolled back.

const client = new Client(buildPoolConfig(readDatabaseUrl()));

interface SeededAccount {
  tenantId: string;
  accountId: string;
}

let accountA: SeededAccount;
let accountB: SeededAccount;

const OWN_ROW_TABLES = [
  'billing_accounts',
  'subscriptions',
  'seats',
  'invoices',
  'invoice_lines',
] as const;

// An account with one row in every own-row billing table, written as the
// migration owner.
const seedBillingAccount = async (label: string): Promise<SeededAccount> => {
  const tenantId = await insertTenant(client, label);
  const account = await client.query<{ id: string }>(
    `INSERT INTO billing.billing_accounts (name, billing_email)
     VALUES ($1, 'billing@example.com') RETURNING id`,
    [`Billing ${label}`],
  );
  const accountId = account.rows[0].id;
  await client.query(
    'UPDATE tenants SET billing_account_id = $2 WHERE id = $1',
    [tenantId, accountId],
  );
  const user = await client.query<{ id: string }>(
    `INSERT INTO users (tenant_id, email, password_hash, first_name, last_name)
     VALUES ($1, $2, 'x', 'Iso', 'Test') RETURNING id`,
    [tenantId, `billing-isolation-${label}-${Date.now()}@example.com`],
  );
  const subscription = await client.query<{ id: string }>(
    `INSERT INTO billing.subscriptions
       (billing_account_id, plan_code, price_book_id, term, current_period_start, current_period_end)
     SELECT $1, 'TECH', id, 'monthly', DATE '2026-04-01', DATE '2026-05-01'
     FROM billing.price_books WHERE plan_code = 'TECH' AND version = 1
     RETURNING id`,
    [accountId],
  );
  await client.query(
    `INSERT INTO billing.seats (billing_account_id, subscription_id, user_id, started_on)
     VALUES ($1, $2, $3, DATE '2026-04-01')`,
    [accountId, subscription.rows[0].id, user.rows[0].id],
  );
  const invoice = await client.query<{ id: string }>(
    `INSERT INTO billing.invoices (billing_account_id, currency, total_ex_gst_cents)
     VALUES ($1, 'AUD', 4900) RETURNING id`,
    [accountId],
  );
  await client.query(
    `INSERT INTO billing.invoice_lines
       (invoice_id, position, line_type, description, quantity, unit_cents, amount_cents)
     VALUES ($1, 1, 'TECH', 'TECH seats', 1, 4900, 4900)`,
    [invoice.rows[0].id],
  );
  return { tenantId, accountId };
};

// Every own-row table, narrowed to the two seeded accounts.
const visibleAccountIds = async (table: (typeof OWN_ROW_TABLES)[number]) => {
  const accountColumn =
    table === 'billing_accounts'
      ? 'id'
      : table === 'invoice_lines'
        ? '(SELECT billing_account_id FROM billing.invoices i WHERE i.id = invoice_id)'
        : 'billing_account_id';
  const result = await client.query<{ account_id: string }>(
    `SELECT DISTINCT ${accountColumn} AS account_id FROM billing.${table}
     WHERE ${accountColumn} IN ($1, $2)`,
    [accountA.accountId, accountB.accountId],
  );
  return result.rows.map((row) => row.account_id);
};

beforeAll(() => client.connect());
afterAll(() => client.end());

beforeEach(async () => {
  await client.query('BEGIN');
  accountA = await seedBillingAccount('billing-a');
  accountB = await seedBillingAccount('billing-b');
});

afterEach(() => client.query('ROLLBACK'));

describe('billing RLS for the tenant role (field_app)', () => {
  it.each(OWN_ROW_TABLES)(
    "sees only its own account's billing.%s rows",
    async (table) => {
      await asTenantRole(client, accountA.tenantId);
      expect(await visibleAccountIds(table)).toEqual([accountA.accountId]);
    },
  );

  it("can't read another account's invoice even by id", async () => {
    await asTenantRole(client, accountA.tenantId);
    const result = await client.query(
      'SELECT id FROM billing.invoices WHERE billing_account_id = $1',
      [accountB.accountId],
    );
    expect(result.rowCount).toBe(0);
  });

  it('sees no billing rows from an organisation with no billing account', async () => {
    const orphan = await insertTenant(client, 'billing-orphan');
    await asTenantRole(client, orphan);
    const result = await client.query('SELECT id FROM billing.subscriptions');
    expect(result.rowCount).toBe(0);
  });

  it('cannot write its own billing rows', async () => {
    await asTenantRole(client, accountA.tenantId);
    await expectRefused(
      client,
      `UPDATE billing.subscriptions SET committed_qty = 1 WHERE billing_account_id = $1`,
      [accountA.accountId],
    );
    await expectRefused(
      client,
      `UPDATE billing.billing_accounts SET suspended_at = NULL WHERE id = $1`,
      [accountA.accountId],
    );
    await expectRefused(
      client,
      `DELETE FROM billing.seats WHERE billing_account_id = $1`,
      [accountA.accountId],
    );
  });
});

describe('billing for the service role (field_service)', () => {
  it.each(OWN_ROW_TABLES)(
    'reads every account in billing.%s',
    async (table) => {
      await asServiceRole(client);
      expect((await visibleAccountIds(table)).sort()).toEqual(
        [accountA.accountId, accountB.accountId].sort(),
      );
    },
  );
});
