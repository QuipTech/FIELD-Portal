import { randomUUID } from 'crypto';
import {
  BillingTestDatabase,
  createBillingTestDatabase,
} from './billingTestDatabase';

// Migrations 0109 and 0110 against a real Postgres: the plan backfill,
// feature keys, metering and the functions the service role relies on.
describe('billing operations migrations', () => {
  let fixture: BillingTestDatabase;

  beforeAll(async () => {
    fixture = await createBillingTestDatabase();
  });
  afterAll(() => fixture.db.close());
  beforeEach(() => fixture.db.exec('BEGIN'));
  afterEach(() => fixture.db.exec('ROLLBACK'));

  const planOf = async (tenantId: string) =>
    (
      await fixture.query(
        `SELECT s.plan_code, s.term, a.billing_email FROM tenants t
         JOIN billing.billing_accounts a ON a.id = t.billing_account_id
         LEFT JOIN billing.subscriptions s ON s.billing_account_id = a.id
         WHERE t.id = $1`,
        [tenantId],
      )
    ).rows;

  it('puts every organisation on monthly ASSET_PRO, billed to its billing admin (T22)', async () => {
    expect(await planOf(fixture.ids.customerTenant)).toEqual([
      {
        plan_code: 'ASSET_PRO',
        term: 'monthly',
        billing_email: 'admin@pit.test',
      },
    ]);
  });

  it("puts QuipTech's own organisation on INTERNAL", async () => {
    expect(await planOf(fixture.ids.platformTenant)).toEqual([
      {
        plan_code: 'INTERNAL',
        term: 'monthly',
        billing_email: 'owner@quiptech.test',
      },
    ]);
  });

  it('adds the missing plan to an account a platform admin set up', async () => {
    expect(await planOf(fixture.ids.setUpTenant)).toEqual([
      {
        plan_code: 'ASSET_PRO',
        term: 'monthly',
        billing_email: 'billing@old.test',
      },
    ]);
  });

  it('resolves feature keys from the plan, never from a plan name in code', async () => {
    const keys = await fixture.asRole(
      'field_app',
      { tenantId: fixture.ids.customerTenant },
      async (client) =>
        (
          await client.query<{ feature_code: string }>(
            'SELECT feature_code FROM current_feature_keys() ORDER BY 1',
          )
        ).rows.map((row) => row.feature_code),
    );
    expect(keys).toEqual([
      'ai.assistant',
      'asset.history',
      'fleet.import',
      'fleet.register',
      'knowledge.read',
      'org.users.unlimited',
      'remote.session',
    ]);
  });

  it('drops the features once a cancelled plan has ended', async () => {
    await fixture.query(
      `UPDATE billing.subscriptions SET status='cancelled', cancel_at=current_date
       WHERE billing_account_id=(SELECT billing_account_id FROM tenants WHERE id=$1)`,
      [fixture.ids.customerTenant],
    );
    const keys = await fixture.asRole(
      'field_app',
      { tenantId: fixture.ids.customerTenant },
      async (client) =>
        (await client.query('SELECT feature_code FROM current_feature_keys()'))
          .rows,
    );
    expect(keys).toEqual([]);
  });

  it('stores a usage event once per idempotency key (T28)', async () => {
    const key = `ai.turn:${randomUUID()}`;
    for (let attempt = 0; attempt < 2; attempt++) {
      await fixture.asRole(
        'field_app',
        {
          tenantId: fixture.ids.customerTenant,
          userId: fixture.ids.customerTech,
        },
        (client) =>
          client.query(
            `SELECT record_my_usage_event('ai.turn', 1, 'turns', NULL, '{"inputTokens":10}', $1)`,
            [key],
          ),
      );
    }
    const rows = (
      await fixture.query(
        `SELECT billing_account_id IS NOT NULL AS has_account, user_id FROM app.usage_events
         WHERE idempotency_key = $1`,
        [key],
      )
    ).rows;
    expect(rows).toEqual([
      { has_account: true, user_id: fixture.ids.customerTech },
    ]);
  });

  it('refuses event types the database records itself', async () => {
    await expect(
      fixture.asRole(
        'field_app',
        { tenantId: fixture.ids.customerTenant },
        (client) =>
          client.query(
            `SELECT record_my_usage_event('storage.delta', 1, 'bytes', NULL, '{}', NULL)`,
          ),
      ),
    ).rejects.toThrow('recorded by the database');
  });

  it('meters photo storage added and removed', async () => {
    const machineId = await fixture.insertMachine(fixture.ids.customerTenant);
    const photoId = randomUUID();
    await fixture.query(
      `INSERT INTO machine_photos(id,tenant_id,machine_id,storage_key,size_bytes) VALUES($1,$2,$3,'k',2048)`,
      [photoId, fixture.ids.customerTenant, machineId],
    );
    await fixture.query(
      'UPDATE machine_photos SET deleted_at = now() WHERE id = $1',
      [photoId],
    );
    const deltas = (
      await fixture.query(
        `SELECT quantity::int FROM app.usage_events
         WHERE event_type = 'storage.delta' AND subject_id = $1 ORDER BY quantity DESC`,
        [photoId],
      )
    ).rows.map((row) => row.quantity);
    expect(deltas).toEqual([2048, -2048]);
  });

  it('lets the service role see personal payers and billing admins only through functions', async () => {
    const admins = await fixture.asRole(
      'field_service',
      {},
      async (client) =>
        (
          await client.query(
            `SELECT email FROM billing.account_admins(
             (SELECT billing_account_id FROM tenants WHERE id = $1))`,
            [fixture.ids.customerTenant],
          )
        ).rows,
    );
    expect(admins).toEqual([{ email: 'admin@pit.test' }]);
    await expect(
      fixture.asRole('field_service', {}, (client) =>
        client.query('SELECT email FROM users LIMIT 1'),
      ),
    ).rejects.toThrow();
    await fixture.asRole('field_service', {}, (client) =>
      client.query('SELECT * FROM billing.personal_payers()'),
    );
  });

  it('sends a billing notification to a user', async () => {
    await fixture.asRole('field_service', {}, (client) =>
      client.query(
        `SELECT billing.notify(ARRAY[$1]::uuid[], 'Invoice overdue', 'Pay now', '/settings/billing')`,
        [fixture.ids.customerAdmin],
      ),
    );
    const rows = (
      await fixture.query(
        `SELECT kind, title FROM notifications WHERE user_id = $1`,
        [fixture.ids.customerAdmin],
      )
    ).rows;
    expect(rows).toEqual([{ kind: 'billing', title: 'Invoice overdue' }]);
  });
});
