import { DatabaseService } from '../database/database.service';

// Whether someone is QuipTech support staff: the support.agent or
// platform.manage permission, or anyone in QuipTech's own organisation
// (is_support_staff(), migration 0073). Read per request, so a change
// applies immediately. Who is the admin stays a permission
// (isSupportAdmin).
export const findIsSupportStaff = async (
  databaseService: DatabaseService,
  userId: string,
): Promise<boolean> => {
  const result = await databaseService.query<{ is_staff: boolean | null }>(
    'SELECT is_support_staff($1) AS is_staff',
    [userId],
  );
  return result.rows[0]?.is_staff === true;
};
