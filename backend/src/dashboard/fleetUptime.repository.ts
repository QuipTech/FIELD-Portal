import { PoolClient } from 'pg';
import { StatusEventRow } from './types/dashboardRows';

// Reads machine_status_events (migration 0053), tenant-filtered.

// Status changes inside the window, plus each machine's last status
// before it (its state when the window opens).
export const listStatusEvents = async (
  client: PoolClient,
  params: { tenantId: string; windowStart: Date },
): Promise<StatusEventRow[]> => {
  const result = await client.query<StatusEventRow>(
    `SELECT e.machine_id, e.status, e.changed_at
     FROM machine_status_events e
     JOIN machines m ON m.id = e.machine_id AND m.deleted_at IS NULL
     WHERE e.tenant_id = $1 AND e.changed_at >= $2
     UNION ALL
     (SELECT DISTINCT ON (e.machine_id) e.machine_id, e.status, e.changed_at
      FROM machine_status_events e
      JOIN machines m ON m.id = e.machine_id AND m.deleted_at IS NULL
      WHERE e.tenant_id = $1 AND e.changed_at < $2
      ORDER BY e.machine_id, e.changed_at DESC)`,
    [params.tenantId, params.windowStart],
  );
  return result.rows;
};

export const findTrackingStart = async (
  client: PoolClient,
  tenantId: string,
): Promise<Date | null> => {
  const result = await client.query<{ started_at: Date | null }>(
    `SELECT min(changed_at) AS started_at FROM machine_status_events
     WHERE tenant_id = $1`,
    [tenantId],
  );
  return result.rows[0]?.started_at ?? null;
};
