import { Client } from 'pg';
import { TENANT_ROLE } from '../src/dataGovernance/dataSchemas.config';

// Fixtures for the support case *.db-spec.ts suites, written as the
// migration owner inside each test's transaction: two organisations, a
// customer in each, a Support Agent (in B, standing in for QuipTech), and
// one open case in A assigned to the agent, with a customer message and
// an internal note.

export interface SupportCaseWorld {
  tenantA: string;
  tenantB: string;
  customerA: string;
  customerB: string;
  agent: string;
  caseId: string;
  caseNumber: number;
}

const insertTenant = async (client: Client, label: string) =>
  (
    await client.query<{ id: string }>(
      `INSERT INTO tenants (name, slug, status) VALUES ($1, $2, 'active') RETURNING id`,
      [`Cases test ${label}`, `cases-test-${label}-${Date.now()}`],
    )
  ).rows[0].id;

const insertUser = async (client: Client, tenantId: string, label: string) =>
  (
    await client.query<{ id: string }>(
      `INSERT INTO users (tenant_id, email, password_hash, first_name, last_name)
       VALUES ($1, $2, 'x', $3, 'Test') RETURNING id`,
      [tenantId, `cases-${label}-${Date.now()}@example.com`, label],
    )
  ).rows[0].id;

export const insertThreadMessage = (
  client: Client,
  world: SupportCaseWorld,
  author: { id: string; role: string; isInternal: boolean },
) =>
  client.query(
    `INSERT INTO support_updates (tenant_id, support_case_id, note, created_by, author_role, is_internal)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      world.tenantA,
      world.caseId,
      `${author.role} message`,
      author.id,
      author.role,
      author.isInternal,
    ],
  );

export const seedSupportCaseWorld = async (
  client: Client,
): Promise<SupportCaseWorld> => {
  const tenantA = await insertTenant(client, 'a');
  const tenantB = await insertTenant(client, 'b');
  const customerA = await insertUser(client, tenantA, 'customerA');
  const customerB = await insertUser(client, tenantB, 'customerB');
  const agent = await insertUser(client, tenantB, 'agent');
  await client.query(
    `INSERT INTO user_roles (tenant_id, user_id, role_id)
     SELECT $1, $2, id FROM roles
     WHERE name = 'Support Agent' AND tenant_id IS NULL AND deleted_at IS NULL`,
    [tenantB, agent],
  );
  const inserted = await client.query<{ id: string; case_number: string }>(
    `INSERT INTO support_cases (tenant_id, created_by, assigned_to, subject, priority, status, sla_due_at)
     VALUES ($1, $2, $3, 'Brake alarm', 'P1', 'open', now() + interval '4 hours')
     RETURNING id, case_number`,
    [tenantA, customerA, agent],
  );
  const world = {
    tenantA,
    tenantB,
    customerA,
    customerB,
    agent,
    caseId: inserted.rows[0].id,
    caseNumber: Number(inserted.rows[0].case_number),
  };
  await insertThreadMessage(client, world, {
    id: customerA,
    role: 'customer',
    isInternal: false,
  });
  await insertThreadMessage(client, world, {
    id: agent,
    role: 'assignee',
    isInternal: true,
  });
  return world;
};

// From here on the transaction runs as the API's tenant role, under RLS.
export const asTenantRole = async (client: Client, tenantId: string) => {
  await client.query(`SET LOCAL ROLE ${TENANT_ROLE}`);
  await client.query("SELECT set_config('app.tenant_id', $1, true)", [
    tenantId,
  ]);
};
