import { PoolClient } from 'pg';
import { KnowledgeAccess } from '../access/knowledgeAccess';
import { CATALOG_COLUMNS, CATALOG_CTE, CATALOG_JOINS } from '../catalogScope';
import { CatalogDocumentRow } from '../types/catalogRows';

export const ATTENTION_REASONS = [
  'needs_review',
  'failed',
  'licence_expired',
  'licence_expiring',
] as const;
export type AttentionReason = (typeof ATTENTION_REASONS)[number];

export interface AttentionRow extends CatalogDocumentRow {
  reason: AttentionReason;
}

const ATTENTION_LIMIT = 200;
const LICENCE_WARNING_DAYS = 30;

// Documents an admin needs to act on, most urgent reason first: the
// organisation's own, plus the shared library for platform admins (the
// only ones who can change it). Run inside withTenant(caller).
export const listAttentionDocuments = async (
  client: PoolClient,
  access: KnowledgeAccess,
): Promise<AttentionRow[]> => {
  const result = await client.query<AttentionRow>(
    `WITH ${CATALOG_CTE},
     flagged AS (
       SELECT c.*,
              CASE
                WHEN c.state = 'needs_review' THEN 'needs_review'
                WHEN c.state = 'failed' THEN 'failed'
                WHEN c.licence_expires_at < now() THEN 'licence_expired'
                WHEN c.licence_expires_at < now() + interval '${LICENCE_WARNING_DAYS} days'
                  THEN 'licence_expiring'
              END AS reason
       FROM catalog c
       WHERE c.state <> 'archived'
         AND (c.tenant_id = $1 OR ($2 AND c.tenant_id IS NULL))
     )
     SELECT ${CATALOG_COLUMNS}, c.reason
     FROM flagged c ${CATALOG_JOINS}
     WHERE c.reason IS NOT NULL
     ORDER BY array_position($3::text[], c.reason), c.updated_at DESC
     LIMIT ${ATTENTION_LIMIT}`,
    [access.tenantId, access.isPlatform, ATTENTION_REASONS],
  );
  return result.rows;
};
