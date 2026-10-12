import { PoolClient } from 'pg';
import { CaseEventType } from './types/supportCaseResponse';
import { CaseEventRow } from './types/supportCaseRows';

const PERSON_VALUE_TYPES = `('assigned', 'unassigned')`;

// For assigned/unassigned, from_value and to_value are user ids; their
// names come from support_case_person, like every other person on a case.
const EVENT_SELECT = `
  SELECT e.id, e.type, e.from_value, e.to_value, e.created_at,
         a.id AS actor_id, a.first_name AS actor_first_name,
         a.last_name AS actor_last_name, a.avatar_url AS actor_avatar_url,
         f.first_name AS from_person_first_name, f.last_name AS from_person_last_name,
         t.first_name AS to_person_first_name, t.last_name AS to_person_last_name
  FROM case_events e
  LEFT JOIN LATERAL support_case_person(e.actor_id) a ON true
  LEFT JOIN LATERAL support_case_person(
    CASE WHEN e.type IN ${PERSON_VALUE_TYPES} THEN e.from_value::uuid END) f ON true
  LEFT JOIN LATERAL support_case_person(
    CASE WHEN e.type IN ${PERSON_VALUE_TYPES} THEN e.to_value::uuid END) t ON true`;

export const listCaseEvents = async (
  client: PoolClient,
  tenantId: string,
  caseId: string,
): Promise<CaseEventRow[]> => {
  const result = await client.query<CaseEventRow>(
    `${EVENT_SELECT}
     WHERE e.tenant_id = $1 AND e.support_case_id = $2
     ORDER BY e.created_at, e.id`,
    [tenantId, caseId],
  );
  return result.rows;
};

export interface NewCaseEvent {
  tenantId: string;
  caseId: string;
  actorId: string | null;
  type: CaseEventType;
  fromValue?: string | null;
  toValue?: string | null;
}

export const insertCaseEvent = async (
  client: PoolClient,
  event: NewCaseEvent,
): Promise<CaseEventRow> => {
  const inserted = await client.query<{ id: string }>(
    `INSERT INTO case_events (tenant_id, support_case_id, actor_id, type, from_value, to_value)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [
      event.tenantId,
      event.caseId,
      event.actorId,
      event.type,
      event.fromValue ?? null,
      event.toValue ?? null,
    ],
  );
  const result = await client.query<CaseEventRow>(
    `${EVENT_SELECT} WHERE e.id = $1`,
    [inserted.rows[0].id],
  );
  return result.rows[0];
};
