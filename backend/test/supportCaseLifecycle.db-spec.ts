import { Client } from 'pg';
import { buildPoolConfig } from '../src/database/buildPoolConfig';
import { readDatabaseUrl } from './dbTestConnection';
import { seedSupportCaseWorld, SupportCaseWorld } from './supportCaseFixtures';

// The status trigger and the auto-close function (migrations 0069, 0072)
// against the real schema. Every test is rolled back.

const HOUR_MS = 3_600_000;

const client = new Client(buildPoolConfig(readDatabaseUrl()));
let world: SupportCaseWorld;

const updateCase = (assignments: string) =>
  client.query(`UPDATE support_cases SET ${assignments} WHERE id = $1`, [
    world.caseId,
  ]);

const readCase = async () =>
  (
    await client.query<{
      status: string;
      sla_due_at: Date;
      sla_paused: boolean;
    }>(
      'SELECT status, sla_due_at, sla_paused FROM support_cases WHERE id = $1',
      [world.caseId],
    )
  ).rows[0];

beforeAll(() => client.connect());
afterAll(() => client.end());
beforeEach(async () => {
  await client.query('BEGIN');
  world = await seedSupportCaseWorld(client);
});
afterEach(() => client.query('ROLLBACK'));

describe('the status trigger', () => {
  it('pauses the SLA while waiting on the customer, and moves the due time on resume', async () => {
    const before = await readCase();
    await updateCase(`status = 'waiting_on_customer'`);
    expect((await readCase()).sla_paused).toBe(true);
    await updateCase(`sla_paused_at = sla_paused_at - interval '2 hours'`);
    await updateCase(`status = 'open'`);
    const after = await readCase();
    expect(after.sla_paused).toBe(false);
    const shiftHours =
      (after.sla_due_at.getTime() - before.sla_due_at.getTime()) / HOUR_MS;
    expect(Math.round(shiftHours)).toBe(2);
  });
});

describe('support_close_resolved_cases', () => {
  it('closes a case resolved more than 7 days ago, with a thread line', async () => {
    await updateCase(`status = 'resolved'`);
    await updateCase(`resolved_at = now() - interval '8 days'`);
    await client.query(
      `UPDATE support_updates SET created_at = now() - interval '9 days'
       WHERE support_case_id = $1`,
      [world.caseId],
    );
    await client.query(
      `SELECT * FROM support_close_resolved_cases(now() - interval '7 days')`,
    );
    expect((await readCase()).status).toBe('closed');
    const events = await client.query(
      `SELECT 1 FROM case_events WHERE support_case_id = $1 AND to_value = 'closed'`,
      [world.caseId],
    );
    expect(events.rowCount).toBe(1);
  });

  it('leaves a case resolved within the last 7 days alone', async () => {
    await updateCase(`status = 'resolved'`);
    await client.query(
      `SELECT * FROM support_close_resolved_cases(now() - interval '7 days')`,
    );
    expect((await readCase()).status).toBe('resolved');
  });
});
