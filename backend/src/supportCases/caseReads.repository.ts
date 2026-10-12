import { PoolClient } from 'pg';

// Where each person last read a case's thread, for the unread badge.
// tenantId is the case's organisation (also for staff).
export const markCaseRead = async (
  client: PoolClient,
  params: { tenantId: string; caseId: string; userId: string },
): Promise<void> => {
  await client.query(
    `INSERT INTO support_case_reads (support_case_id, user_id, tenant_id, last_read_at)
     VALUES ($2, $3, $1, now())
     ON CONFLICT (support_case_id, user_id) DO UPDATE SET last_read_at = now()`,
    [params.tenantId, params.caseId, params.userId],
  );
};

// A customer's badge: cases they raised with a reply (never an internal
// note) they haven't read yet.
export const countUnreadCasesForCustomer = async (
  client: PoolClient,
  tenantId: string,
  userId: string,
): Promise<number> => {
  const result = await client.query<{ count: string }>(
    `SELECT count(*) FROM support_cases c
     WHERE c.tenant_id = $1 AND c.created_by = $2 AND c.deleted_at IS NULL
       AND EXISTS (
         SELECT 1 FROM support_updates u
         LEFT JOIN support_case_reads cr ON cr.support_case_id = c.id AND cr.user_id = $2
         WHERE u.support_case_id = c.id AND NOT u.is_internal
           AND u.created_by IS DISTINCT FROM $2
           AND u.created_at > COALESCE(cr.last_read_at, '-infinity')
       )`,
    [tenantId, userId],
  );
  return Number(result.rows[0]?.count ?? 0);
};
