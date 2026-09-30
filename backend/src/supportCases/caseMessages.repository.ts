import { PoolClient } from 'pg';
import { CaseMessageRow } from './types/supportCaseRows';

const MESSAGE_SELECT = `
  SELECT u.id, u.note, u.created_at,
         a.id AS author_id, a.first_name AS author_first_name, a.last_name AS author_last_name,
         c.created_by AS case_reporter_id
  FROM support_updates u
  JOIN support_cases c ON c.id = u.support_case_id
  LEFT JOIN users a ON a.id = u.created_by`;

export const listCaseMessages = async (
  client: PoolClient,
  tenantId: string,
  caseId: string,
): Promise<CaseMessageRow[]> => {
  const result = await client.query<CaseMessageRow>(
    `${MESSAGE_SELECT}
     WHERE u.tenant_id = $1 AND u.support_case_id = $2
     ORDER BY u.created_at, u.id`,
    [tenantId, caseId],
  );
  return result.rows;
};

export const insertCaseMessage = async (
  client: PoolClient,
  params: { tenantId: string; caseId: string; authorId: string; body: string },
): Promise<CaseMessageRow> => {
  const inserted = await client.query<{ id: string }>(
    `INSERT INTO support_updates (tenant_id, support_case_id, note, created_by)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [params.tenantId, params.caseId, params.body, params.authorId],
  );
  const result = await client.query<CaseMessageRow>(
    `${MESSAGE_SELECT} WHERE u.id = $1`,
    [inserted.rows[0].id],
  );
  return result.rows[0];
};
