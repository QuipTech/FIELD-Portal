import { Client, PoolClient } from 'pg';
import { buildPoolConfig } from '../src/database/buildPoolConfig';
import {
  findCaseByNumber,
  listCases,
} from '../src/supportCases/supportCases.repository';
import { listCaseMessages } from '../src/supportCases/caseMessages.repository';
import { readDatabaseUrl } from './dbTestConnection';
import {
  asTenantRole,
  insertThreadMessage,
  seedSupportCaseWorld,
  SupportCaseWorld,
} from './supportCaseFixtures';

// Who can see a support case, against the real schema (migrations
// 0069–0072) and RLS, as the tenant role the API runs as. Every test is
// rolled back.

const client = new Client(buildPoolConfig(readDatabaseUrl()));
const asPool = client as unknown as PoolClient;
let world: SupportCaseWorld;

beforeAll(() => client.connect());
afterAll(() => client.end());
beforeEach(async () => {
  await client.query('BEGIN');
  world = await seedSupportCaseWorld(client);
});
afterEach(() => client.query('ROLLBACK'));

describe("a customer can't read another company's case", () => {
  it('is invisible to another organisation, even asked for by its own tenant id', async () => {
    await asTenantRole(client, world.tenantB);
    const { tenantA, tenantB, caseNumber } = world;
    expect(await findCaseByNumber(asPool, tenantB, caseNumber)).toBeNull();
    expect(await findCaseByNumber(asPool, tenantA, caseNumber)).toBeNull();
    expect(await listCases(asPool, tenantA, { status: 'all' })).toEqual([]);
    const raw = await client.query(
      'SELECT 1 FROM support_cases WHERE id = $1',
      [world.caseId],
    );
    expect(raw.rowCount).toBe(0);
  });

  it('is visible to its own organisation, with the staff assignee named', async () => {
    await asTenantRole(client, world.tenantA);
    const found = await findCaseByNumber(
      asPool,
      world.tenantA,
      world.caseNumber,
    );
    expect(found?.assignee_first_name).toBe('agent');
  });

  it("doesn't name users of other organisations who aren't support staff", async () => {
    await asTenantRole(client, world.tenantA);
    const result = await client.query('SELECT * FROM support_case_person($1)', [
      world.customerB,
    ]);
    expect(result.rowCount).toBe(0);
  });
});

describe('a customer never receives internal notes', () => {
  it('leaves them out of the thread a customer reads', async () => {
    await asTenantRole(client, world.tenantA);
    const thread = { tenantId: world.tenantA, caseId: world.caseId };
    const forCustomer = await listCaseMessages(asPool, {
      ...thread,
      includeInternal: false,
    });
    expect(forCustomer.map((row) => row.author_role)).toEqual(['customer']);
    const forStaff = await listCaseMessages(asPool, {
      ...thread,
      includeInternal: true,
    });
    expect(forStaff).toHaveLength(2);
  });

  it('refuses an internal note written as a customer', async () => {
    await expect(
      insertThreadMessage(client, world, {
        id: world.customerA,
        role: 'customer',
        isInternal: true,
      }),
    ).rejects.toMatchObject({ code: '23514' });
  });
});

describe('support.agent', () => {
  it("can't be granted to an organisation's own role", async () => {
    const role = await client.query<{ id: string }>(
      `INSERT INTO roles (tenant_id, name) VALUES ($1, 'Sneaky') RETURNING id`,
      [world.tenantA],
    );
    await expect(
      client.query(
        `INSERT INTO role_permissions (role_id, permission_id, tenant_id)
         SELECT $1, id, $2 FROM permissions WHERE code = 'support.agent'`,
        [role.rows[0].id, world.tenantA],
      ),
    ).rejects.toMatchObject({ code: '23514' });
  });
});
