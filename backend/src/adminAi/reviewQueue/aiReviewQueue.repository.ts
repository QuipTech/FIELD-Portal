import { PoolClient } from 'pg';
import { DatabaseService } from '../../database/database.service';
import {
  ReviewerRow,
  ReviewItemRow,
  ReviewStatusCountRow,
} from '../types/adminAiRows';

export const listReviewItems = async (
  databaseService: DatabaseService,
  params: {
    status?: string;
    reviewerId?: string;
    itemId?: string;
    limit: number;
    offset: number;
  },
): Promise<ReviewItemRow[]> => {
  const result = await databaseService.query<ReviewItemRow>(
    `SELECT * FROM admin_list_ai_review_items($1, $2, $3, $4, $5)`,
    [
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
): Promise<ReviewStatusCountRow[]> => {
  const result = await databaseService.query<ReviewStatusCountRow>(
    `SELECT * FROM admin_count_ai_review_statuses()`,
  );
  return result.rows;
};

export const listReviewers = async (
  databaseService: DatabaseService,
): Promise<ReviewerRow[]> => {
  const result = await databaseService.query<ReviewerRow>(
    `SELECT * FROM admin_list_ai_reviewers()`,
  );
  return result.rows;
};

// False when there's no such item.
export const updateReviewItem = async (
  client: PoolClient,
  params: {
    itemId: string;
    status: string;
    reviewerId: string | null;
    notes?: string;
  },
): Promise<boolean> => {
  const result = await client.query<{ tenant_id: string | null }>(
    `SELECT admin_update_ai_review_item($1, $2, $3, $4) AS tenant_id`,
    [params.itemId, params.status, params.reviewerId, params.notes ?? null],
  );
  return Boolean(result.rows[0]?.tenant_id);
};
