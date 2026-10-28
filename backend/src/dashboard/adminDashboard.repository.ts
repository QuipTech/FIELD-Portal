import { PoolClient } from 'pg';
import { DUE_SOON_SHARE } from '../supportCases/caseSla';

const LISTED_CASES = 5;

export interface NearBreachCaseRow {
  case_number: string;
  subject: string;
  priority: string;
  sla_due_at: Date;
  sla_state: 'breached' | 'due_soon';
  total_count: string;
  breached_count: string;
}

// Run inside withTenant(caller); every query also filters on tenant_id.

// Cases whose SLA clock is running and that are breached or due soon,
// with the same rule as a case's sla.state (supportCases/caseSla.ts),
// soonest due first.
export const listCasesNearSlaBreach = async (
  client: PoolClient,
  tenantId: string,
): Promise<NearBreachCaseRow[]> => {
  const result = await client.query<NearBreachCaseRow>(
    `SELECT c.case_number, c.subject, c.priority, c.sla_due_at,
            CASE WHEN c.sla_due_at < now() THEN 'breached' ELSE 'due_soon' END AS sla_state,
            count(*) OVER () AS total_count,
            count(*) FILTER (WHERE c.sla_due_at < now()) OVER () AS breached_count
     FROM support_cases c
     WHERE c.tenant_id = $1 AND c.deleted_at IS NULL
       AND c.status IN ('new', 'open') AND NOT c.sla_paused AND c.sla_due_at IS NOT NULL
       AND (c.sla_due_at < now()
            OR c.sla_due_at - now() <= (c.sla_due_at - c.created_at) * $2::float)
     ORDER BY c.sla_due_at
     LIMIT ${LISTED_CASES}`,
    [tenantId, DUE_SOON_SHARE],
  );
  return result.rows;
};

// Answers flagged (no source, marked wrong…) that no one has closed yet.
export const countAnswersToReview = async (
  client: PoolClient,
  tenantId: string,
): Promise<number> => {
  const result = await client.query<{ count: string }>(
    `SELECT count(*) FROM ai_review_items
     WHERE tenant_id = $1 AND status IN ('unreviewed', 'in_review')`,
    [tenantId],
  );
  return Number(result.rows[0].count);
};
