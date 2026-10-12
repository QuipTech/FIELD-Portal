import { PoolClient } from 'pg';
import { CaseAuthorRole } from './types/supportCaseResponse';
import { CaseMessageRow } from './types/supportCaseRows';

const MESSAGE_SELECT = `
  SELECT u.id, u.note, u.created_at, u.author_role, u.is_internal,
         a.id AS author_id, a.first_name AS author_first_name,
         a.last_name AS author_last_name, a.avatar_url AS author_avatar_url
  FROM support_updates u
  LEFT JOIN LATERAL support_case_person(u.created_by) a ON true`;

// includeInternal is false for every customer request: internal notes are
// filtered out here, in the query, not by the caller.
export const listCaseMessages = async (
  client: PoolClient,
  params: { tenantId: string; caseId: string; includeInternal: boolean },
): Promise<CaseMessageRow[]> => {
  const result = await client.query<CaseMessageRow>(
    `${MESSAGE_SELECT}
     WHERE u.tenant_id = $1 AND u.support_case_id = $2
       AND ($3::boolean OR NOT u.is_internal)
     ORDER BY u.created_at, u.id`,
    [params.tenantId, params.caseId, params.includeInternal],
  );
  return result.rows;
};

export const insertCaseMessage = async (
  client: PoolClient,
  params: {
    tenantId: string;
    caseId: string;
    authorId: string;
    authorRole: CaseAuthorRole;
    body: string;
    isInternal: boolean;
  },
): Promise<CaseMessageRow> => {
  const inserted = await client.query<{ id: string }>(
    `INSERT INTO support_updates
       (tenant_id, support_case_id, note, created_by, author_role, is_internal)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [
      params.tenantId,
      params.caseId,
      params.body,
      params.authorId,
      params.authorRole,
      params.isInternal,
    ],
  );
  const result = await client.query<CaseMessageRow>(
    `${MESSAGE_SELECT} WHERE u.id = $1`,
    [inserted.rows[0].id],
  );
  return result.rows[0];
};
