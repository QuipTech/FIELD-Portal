import 'reflect-metadata';
import { Client, PoolClient } from 'pg';
import { buildPoolConfig } from '../src/database/buildPoolConfig';
import { readDatabaseUrl } from './dbTestConnection';
import { asTenantRole } from './isolationFixtures';
import {
  insertThreadMessage,
  seedSupportCaseWorld,
  SupportCaseWorld,
} from './supportCaseFixtures';
import { listCaseMessages } from '../src/supportCases/caseMessages.repository';

// First response (migration 0103) and thread polling against the real
// schema. Every test is rolled back.

const client = new Client(buildPoolConfig(readDatabaseUrl()));
// The repository takes a pool client; a plain Client has the same query().
const db = client as unknown as PoolClient;
let world: SupportCaseWorld;

const readFirstResponse = async () =>
  (
    await client.query<{ first_response_at: Date | null }>(
      'SELECT first_response_at FROM support_cases WHERE id = $1',
      [world.caseId],
    )
  ).rows[0].first_response_at;

beforeAll(() => client.connect());
afterAll(() => client.end());
beforeEach(async () => {
  await client.query('BEGIN');
  world = await seedSupportCaseWorld(client);
});
afterEach(() => client.query('ROLLBACK'));

describe('first response', () => {
  it("isn't set by an internal note, then keeps the first staff reply", async () => {
    expect(await readFirstResponse()).toBeNull();
    const reply = { id: world.agent, role: 'assignee', isInternal: false };
    await insertThreadMessage(client, world, reply);
    const first = await readFirstResponse();
    expect(first).toBeInstanceOf(Date);
    await insertThreadMessage(client, world, reply);
    expect(await readFirstResponse()).toEqual(first);
  });

  it('is returned by the staff queue', async () => {
    const rows = await client.query(
      `SELECT first_response_at FROM admin_list_support_cases($1, NULL, 'all', $2, NULL, NULL, NULL, 10, 0)`,
      [world.agent, world.tenantA],
    );
    expect(rows.rows).toEqual([{ first_response_at: null }]);
  });
});

describe('polling a thread', () => {
  it('gives only newer messages, and never internal notes to a customer', async () => {
    await client.query(
      'UPDATE support_updates SET created_at = now() - interval $$1 hour$$ WHERE support_case_id = $1',
      [world.caseId],
    );
    await insertThreadMessage(client, world, {
      id: world.agent,
      role: 'assignee',
      isInternal: true,
    });
    await insertThreadMessage(client, world, {
      id: world.customerA,
      role: 'customer',
      isInternal: false,
    });
    await asTenantRole(client, world.tenantA);
    const since = new Date(Date.now() - 30 * 60_000);
    const forCustomer = await listCaseMessages(db, {
      tenantId: world.tenantA,
      caseId: world.caseId,
      includeInternal: false,
      since,
    });
    expect(forCustomer.map((row) => row.author_role)).toEqual(['customer']);
    const forStaff = await listCaseMessages(db, {
      tenantId: world.tenantA,
      caseId: world.caseId,
      includeInternal: true,
      since,
    });
    expect(forStaff.map((row) => row.is_internal).sort()).toEqual([
      false,
      true,
    ]);
  });
});
