import 'reflect-metadata';
import { Client, PoolClient } from 'pg';
import { buildPoolConfig } from '../src/database/buildPoolConfig';
import { readDatabaseUrl } from './dbTestConnection';
import { asTenantRole, insertTenant } from './isolationFixtures';
import * as idempotency from '../src/idempotency/idempotency.repository';
import * as devices from '../src/notifications/devices/pushDevices.repository';
import * as preferences from '../src/notifications/preferences/notificationPreferences.repository';
import { listCasesNearSlaBreach } from '../src/dashboard/adminDashboard.repository';

// Idempotency keys, push devices, notification preferences (migration
// 0106) and the admin dashboard's SLA query against a real database
// (npm run test:db), as the tenant role so RLS applies. Rolled back.

const client = new Client(buildPoolConfig(readDatabaseUrl()));
// The repositories take a pool client; a plain Client has the same query().
const db = client as unknown as PoolClient;

let tenantId: string;
let userId: string;

const insertReturningId = async (sql: string, params: unknown[]) =>
  (await client.query<{ id: string }>(sql, params)).rows[0].id;

beforeAll(() => client.connect());
afterAll(() => client.end());

beforeEach(async () => {
  await client.query('BEGIN');
  tenantId = await insertTenant(client, 'sync');
  userId = await insertReturningId(
    `INSERT INTO users (tenant_id, email, first_name, last_name, cognito_sub)
     VALUES ($1, $2, 'Tess', 'Tech', $2) RETURNING id`,
    [tenantId, `sync-${Date.now()}@example.com`],
  );
  await asTenantRole(client, tenantId);
});

afterEach(() => client.query('ROLLBACK'));

describe('idempotency keys', () => {
  const ref = () => ({ tenantId, userId, key: 'outbox-0001' });
  const route = 'POST /machines/m/history';

  it('claims once, then replays the saved response', async () => {
    expect(await idempotency.claimKey(db, { ...ref(), route })).toEqual({
      state: 'claimed',
    });
    expect(await idempotency.claimKey(db, { ...ref(), route })).toEqual({
      state: 'in_progress',
      route,
    });
    await idempotency.completeKey(db, {
      ...ref(),
      status: 201,
      body: { id: 'e1' },
    });
    expect(await idempotency.claimKey(db, { ...ref(), route })).toEqual({
      state: 'done',
      route,
      status: 201,
      body: { id: 'e1' },
    });
  });

  it('can be reclaimed after a release or once a claim goes stale', async () => {
    await idempotency.claimKey(db, { ...ref(), route });
    await idempotency.releaseKey(db, ref());
    expect((await idempotency.claimKey(db, { ...ref(), route })).state).toBe(
      'claimed',
    );
    await client.query(
      `UPDATE idempotency_keys SET created_at = now() - interval '5 minutes' WHERE key = $1`,
      [ref().key],
    );
    expect((await idempotency.claimKey(db, { ...ref(), route })).state).toBe(
      'claimed',
    );
  });
});

describe('push devices and preferences', () => {
  it('refreshes a re-registered token and deletes on sign-out', async () => {
    const scope = { tenantId, userId };
    const first = await devices.upsertPushDevice(db, {
      ...scope,
      deviceType: 'ios',
      pushToken: 'tok-123',
      appVersion: '1.0.0',
    });
    const again = await devices.upsertPushDevice(db, {
      ...scope,
      deviceType: 'ios',
      pushToken: 'tok-123',
      appVersion: '1.1.0',
    });
    expect(again.id).toBe(first.id);
    expect(again.app_version).toBe('1.1.0');
    expect(await devices.listPushDevices(db, scope)).toHaveLength(1);
    expect(
      await devices.deletePushDevice(db, { ...scope, deviceId: first.id }),
    ).toBe(true);
    expect(await devices.listPushDevices(db, scope)).toEqual([]);
  });

  it('saves preferences, none until then', async () => {
    const scope = { tenantId, userId };
    expect(await preferences.findNotificationPreferences(db, scope)).toBeNull();
    await preferences.saveNotificationPreferences(db, {
      ...scope,
      pushEnabled: false,
      emailEnabled: true,
      mutedKinds: ['case_priority'],
    });
    expect(await preferences.findNotificationPreferences(db, scope)).toEqual({
      push_enabled: false,
      email_enabled: true,
      muted_kinds: ['case_priority'],
    });
  });
});

describe('admin dashboard', () => {
  it('lists breached and due-soon cases, not on-track or paused ones', async () => {
    const insertCase = (
      subject: string,
      created: string,
      due: string,
      status = 'open',
    ) =>
      client.query(
        `INSERT INTO support_cases (tenant_id, created_by, subject, priority, status, created_at, sla_due_at)
         VALUES ($1, $2, $3, 'P1', $4, now() + $5::interval, now() + $6::interval)`,
        [tenantId, userId, subject, status, created, due],
      );
    await insertCase('breached', '-5 hours', '-1 hour');
    await insertCase('due soon', '-3 hours 30 minutes', '30 minutes');
    await insertCase('on track', '-1 hour', '3 hours');
    await insertCase('waiting', '-5 hours', '-1 hour', 'waiting_on_customer');
    const rows = await listCasesNearSlaBreach(db, tenantId);
    expect(rows.map((row) => [row.subject, row.sla_state])).toEqual([
      ['breached', 'breached'],
      ['due soon', 'due_soon'],
    ]);
    expect(rows[0]).toMatchObject({ total_count: '2', breached_count: '1' });
  });
});
