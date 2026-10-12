import { PoolClient } from 'pg';
import { DatabaseService } from '../../database/database.service';
import { AdminScope } from '../../auth/adminScope/adminScope';
import {
  ReviewerRow,
  ReviewItemRow,
  ReviewStatusCountRow,
} from '../types/adminAiRows';

// scope.tenantId is each function's p_tenant_id (migration 0056): the
// scoped organisation, or null (every organisation) for the Owner.

export const listReviewItems = async (
  databaseService: DatabaseService,
  scope: AdminScope,
  params: {
    status?: string;
    reviewerId?: string;
    itemId?: string;
    limit: number;
    offset: number;
  },
): Promise<ReviewItemRow[]> => {
  const result = await databaseService.query<ReviewItemRow>(
    `SELECT * FROM admin_list_ai_review_items($1, $2, $3, $4, $5, $6)`,
    [
      scope.tenantId,
      params.status ?? null,
      params.reviewerId ?? null,
      params.itemId ?? null,
      params.limit,
      params.offset,
    ],
  );
  return result.rows;
};

export const countReviewStatuses = async (
  databaseService: DatabaseService,
  scope: AdminScope,
): Promise<ReviewStatusCountRow[]> => {
  const result = await databaseService.query<ReviewStatusCountRow>(
    `SELECT * FROM admin_count_ai_review_statuses($1)`,
    [scope.tenantId],
  );
  return result.rows;
};

export const listReviewers = async (
  databaseService: DatabaseService,
  scope: AdminScope,
): Promise<ReviewerRow[]> => {
  const result = await databaseService.query<ReviewerRow>(
    `SELECT * FROM admin_list_ai_reviewers($1)`,
    [scope.tenantId],
  );
  return result.rows;
};

// False when there's no such item in scope.
export const updateReviewItem = async (
  client: PoolClient,
  scope: AdminScope,
  params: {
    itemId: string;
    status: string;
    reviewerId: string | null;
    notes?: string;
  },
): Promise<boolean> => {
  const result = await client.query<{ tenant_id: string | null }>(
    `SELECT admin_update_ai_review_item($1, $2, $3, $4, $5) AS tenant_id`,
    [
      scope.tenantId,
      params.itemId,
      params.status,
      params.reviewerId,
      params.notes ?? null,
    ],
  );
  return Boolean(result.rows[0]?.tenant_id);
};
