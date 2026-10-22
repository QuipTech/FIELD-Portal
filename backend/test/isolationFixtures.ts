import { Client } from 'pg';
import {
  SERVICE_ROLE,
  TENANT_ROLE,
} from '../src/dataGovernance/dataSchemas.config';

// Shared by the *.db-spec.ts isolation suites. They run as the migration
// owner inside a transaction that is rolled back, and SET ROLE to check
// what the tenant and service roles can do.

const PERMISSION_DENIED = '42501';

export const insertTenant = async (
  client: Client,
  label: string,
): Promise<string> => {
  const slug = `isolation-test-${label}-${Date.now()}`;
  const result = await client.query<{ id: string }>(
    `INSERT INTO tenants (name, slug, status) VALUES ($1, $2, 'active') RETURNING id`,
    [`Isolation test ${label}`, slug],
  );
  return result.rows[0].id;
};

export const asTenantRole = async (client: Client, tenantId: string) => {
  await client.query(`SET LOCAL ROLE ${TENANT_ROLE}`);
  await client.query("SELECT set_config('app.tenant_id', $1, true)", [
    tenantId,
  ]);
};

export const asServiceRole = (client: Client) =>
  client.query(`SET LOCAL ROLE ${SERVICE_ROLE}`);

// Runs a statement that must be refused; the savepoint keeps the
// surrounding transaction usable afterwards.
export const expectRefused = async (
  client: Client,
  sql: string,
  params: unknown[] = [],
) => {
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
