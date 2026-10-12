import { PoolClient } from 'pg';
import {
  FLEET_COLUMNS,
  FLEET_FROM,
} from '../machineFleet/machineFleet.repository';
import { FleetMachineRow } from '../machineFleet/types/machineFleetRows';

const MY_MACHINES_LIMIT = 4;

// Machines the user registered, logged history on, raised cases for or
// asked the assistant about; down and service-due ones first.
export const listMyMachines = async (
  client: PoolClient,
  params: { tenantId: string; userId: string },
): Promise<FleetMachineRow[]> => {
  const result = await client.query<FleetMachineRow>(
    `WITH touched AS (
       SELECT machine_id, created_at AS at FROM technical_history_entries
       WHERE tenant_id = $1 AND created_by = $2 AND deleted_at IS NULL
       UNION ALL
       SELECT machine_id, updated_at FROM support_cases
       WHERE tenant_id = $1 AND created_by = $2 AND machine_id IS NOT NULL
         AND deleted_at IS NULL
       UNION ALL
       SELECT machine_id, updated_at FROM ai_conversations
       WHERE tenant_id = $1 AND user_id = $2 AND machine_id IS NOT NULL
         AND deleted_at IS NULL
       UNION ALL
       SELECT id, created_at FROM machines
       WHERE tenant_id = $1 AND created_by = $2
     ), latest AS (
       SELECT machine_id, max(at) AS last_worked_at FROM touched GROUP BY machine_id
     )
     SELECT ${FLEET_COLUMNS} ${FLEET_FROM}
     JOIN latest l ON l.machine_id = m.id
     WHERE m.tenant_id = $1 AND m.deleted_at IS NULL
     ORDER BY CASE m.status WHEN 'down' THEN 0 WHEN 'service_due' THEN 1 ELSE 2 END,
              l.last_worked_at DESC
     LIMIT ${MY_MACHINES_LIMIT}`,
    [params.tenantId, params.userId],
  );
  return result.rows;
};
