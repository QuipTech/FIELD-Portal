import { PoolClient } from 'pg';

export interface AssignedTechnicianRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  assigned_at: Date;
}

// Every query filters on tenant_id itself: the backend's database role may
// bypass RLS. Run inside withTenant(caller).

export const listAssignedTechnicians = async (
  client: PoolClient,
  tenantId: string,
  machineId: string,
): Promise<AssignedTechnicianRow[]> => {
  const result = await client.query<AssignedTechnicianRow>(
    `SELECT u.id, u.first_name, u.last_name, u.avatar_url, a.created_at AS assigned_at
     FROM machine_assignments a
     JOIN users u ON u.id = a.user_id AND u.deleted_at IS NULL
     WHERE a.tenant_id = $1 AND a.machine_id = $2
     ORDER BY u.first_name, u.last_name, u.id`,
    [tenantId, machineId],
  );
  return result.rows;
};

export const isOrganisationUser = async (
  client: PoolClient,
  tenantId: string,
  userId: string,
): Promise<boolean> => {
  const result = await client.query(
    'SELECT 1 FROM users WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL',
    [userId, tenantId],
  );
  return (result.rowCount ?? 0) > 0;
};

// false when already assigned.
export const insertAssignment = async (
  client: PoolClient,
  params: {
    tenantId: string;
    machineId: string;
    userId: string;
    assignedBy: string;
  },
): Promise<boolean> => {
  const result = await client.query(
    `INSERT INTO machine_assignments (tenant_id, machine_id, user_id, assigned_by)
     VALUES ($1, $2, $3, $4) ON CONFLICT (machine_id, user_id) DO NOTHING`,
    [params.tenantId, params.machineId, params.userId, params.assignedBy],
  );
  return (result.rowCount ?? 0) > 0;
};

// false when they weren't assigned.
export const deleteAssignment = async (
  client: PoolClient,
  params: { tenantId: string; machineId: string; userId: string },
): Promise<boolean> => {
  const result = await client.query(
    `DELETE FROM machine_assignments
     WHERE tenant_id = $1 AND machine_id = $2 AND user_id = $3`,
    [params.tenantId, params.machineId, params.userId],
  );
  return (result.rowCount ?? 0) > 0;
};
