import { PoolClient } from 'pg';

// AI queries metered since `since` (app.usage_events, written by the
// ai_messages trigger in migration 0047: one per question asked). Run
// inside withTenant(caller); userId narrows it to one person.
export const countAiQueries = async (
  client: PoolClient,
  params: { tenantId: string; since: Date; userId?: string },
): Promise<number> => {
  const result = await client.query<{ count: string }>(
    `SELECT count(*) FROM app.usage_events
     WHERE tenant_id = $1 AND event_type = 'ai_query' AND occurred_at >= $2
       AND ($3::uuid IS NULL OR user_id = $3)`,
    [params.tenantId, params.since, params.userId ?? null],
  );
  return Number(result.rows[0].count);
};
