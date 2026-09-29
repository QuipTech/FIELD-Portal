import { DatabaseService } from '../database/database.service';
import { escapeLikePattern } from '../common/utils/escapeLikePattern';
import { AdminUserRow } from './types/adminUserRows';

export const listAdminUsers = async (
  databaseService: DatabaseService,
  params: { search?: string; role?: string; limit: number; offset: number },
): Promise<AdminUserRow[]> => {
  const result = await databaseService.query<AdminUserRow>(
    `SELECT * FROM admin_list_users($1, $2, $3, $4)`,
    [
      params.search ? escapeLikePattern(params.search) : null,
      params.role ?? null,
      params.limit,
      params.offset,
    ],
  );
  return result.rows;
};
