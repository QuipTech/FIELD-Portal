import 'reflect-metadata';
import { Client, PoolClient } from 'pg';
import { buildPoolConfig } from '../src/database/buildPoolConfig';
import { DatabaseService } from '../src/database/database.service';
import { readDatabaseUrl } from './dbTestConnection';
import { asServiceRole, asTenantRole, insertTenant } from './isolationFixtures';
import * as profile from '../src/users/userProfile.repository';
import { findUserById } from '../src/auth/auth.repository';
import { isTeamMember } from '../src/team/teamAccess.repository';
import * as customerBilling from '../src/billing/customerBilling/customerBilling.repository';

// Profile fields (migration 0105), the Team membership check and the
// customer billing reads against a real database (npm run test:db).
// Fixtures are written as the migration owner; everything is rolled back.

const client = new Client(buildPoolConfig(readDatabaseUrl()));
// The repositories take a pool client or a query-only reader; a plain
// Client has the same query().
const db = client as unknown as PoolClient;
// isTeamMember opens its own tenant transaction; inside the test's
// transaction a plain query is enough.
const tenantScopedDatabase = {
  withTenant: (_tenantId: string, work: (c: PoolClient) => unknown) => work(db),
} as unknown as DatabaseService;

let tenantA: string;
let tenantB: string;
let userA: string;

const insertReturningId = async (sql: string, params: unknown[]) =>
  (await client.query<{ id: string }>(sql, params)).rows[0].id;

const insertUser = (tenantId: string, label: string) =>
  insertReturningId(
    `INSERT INTO users (tenant_id, email, first_name, last_name, cognito_sub)
     VALUES ($1, $2, $3, 'Test', $2) RETURNING id`,
    [tenantId, `${label}-${Date.now()}@example.com`, label],
  );

beforeAll(() => client.connect());
afterAll(() => client.end());

beforeEach(async () => {
  await client.query('BEGIN');
  tenantA = await insertTenant(client, 'profile-a');
  tenantB = await insertTenant(client, 'profile-b');
  userA = await insertUser(tenantA, 'tess');
});

afterEach(() => client.query('ROLLBACK'));

describe('profile', () => {
  it('changes only the fields sent, and /auth/me reads them', async () => {
    await asTenantRole(client, tenantA);
    const scope = { userId: userA, tenantId: tenantA };
    await profile.updateUserProfile(db, {
      ...scope,
      site: 'Pit 4',
      language: 'en-AU',
    });
    const updated = await profile.updateUserProfile(db, {
      ...scope,
      lastName: 'Tech',
    });
    expect(updated).toMatchObject({
      first_name: 'tess',
      last_name: 'Tech',
      site: 'Pit 4',
      language: 'en-AU',
    });
    expect(await findUserById(db, userA)).toMatchObject({
      site: 'Pit 4',
      language: 'en-AU',
      phone_number: null,
    });
  });

  it('refuses a malformed language tag', async () => {
    await expect(
      client.query(`UPDATE users SET language = 'english' WHERE id = $1`, [
        userA,
      ]),
    ).rejects.toMatchObject({ code: '23514' });
  });
});

describe('team', () => {
  it('only counts people in the organisation', async () => {
    const outsider = await insertUser(tenantB, 'outsider');
    expect(await isTeamMember(tenantScopedDatabase, tenantA, userA)).toBe(true);
    expect(await isTeamMember(tenantScopedDatabase, tenantA, outsider)).toBe(
      false,
    );
  });
});

describe('customer billing', () => {
  it("lists only the organisation's invoices Stripe has", async () => {
    const accountId = await insertReturningId(
      `INSERT INTO billing.billing_accounts (name, billing_email, stripe_customer_id)
       VALUES ('Acme', 'billing@example.com', 'cus_test') RETURNING id`,
      [],
    );
    await client.query(
      'UPDATE tenants SET billing_account_id = $2 WHERE id = $1',
      [tenantA, accountId],
    );
    const synced = await insertReturningId(
      `INSERT INTO billing.invoices (billing_account_id, status, currency, total_ex_gst_cents, stripe_invoice_id)
       VALUES ($1, 'synced', 'aud', 1000, 'in_test') RETURNING id`,
      [accountId],
    );
    const draft = await insertReturningId(
      `INSERT INTO billing.invoices (billing_account_id, status, currency, total_ex_gst_cents)
       VALUES ($1, 'draft', 'aud', 500) RETURNING id`,
      [accountId],
    );
    await asServiceRole(client);
    expect(
      await customerBilling.findOrganisationAccount(client, tenantA),
    ).toEqual({
      billing_account_id: accountId,
      stripe_customer_id: 'cus_test',
    });
    expect(
      await customerBilling.findOrganisationAccount(client, tenantB),
    ).toBeNull();
    const invoices = await customerBilling.listAccountInvoices(
      client,
      accountId,
    );
    expect(invoices.map((row) => row.id)).toEqual([synced]);
    expect(invoices[0].has_stripe_invoice).toBe(true);
    const lookup = { billingAccountId: accountId };
    expect(
      await customerBilling.findAccountStripeInvoiceId(client, {
        ...lookup,
        invoiceId: synced,
      }),
    ).toBe('in_test');
    expect(
      await customerBilling.findAccountStripeInvoiceId(client, {
        ...lookup,
        invoiceId: draft,
      }),
    ).toBeNull();
  });
});
