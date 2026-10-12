import { DatabaseService } from '../database/database.service';

// SECURITY DEFINER functions from migration 0077: the user may be in any
// organisation.

export interface RemovableUserRow {
  tenant_id: string;
  email: string;
  cognito_sub: string | null;
  avatar_storage_key: string | null;
  // The only active Owner left (see is_last_active_owner, 0077).
  is_last_owner: boolean;
}

export type RemoveUserOutcome = 'removed' | 'not_found' | 'last_owner';

export const findRemovableUser = async (
  databaseService: DatabaseService,
  userId: string,
): Promise<RemovableUserRow | null> => {
  const result = await databaseService.query<RemovableUserRow>(
    'SELECT * FROM admin_find_removable_user($1)',
    [userId],
  );
  return result.rows[0] ?? null;
};

export const removeUser = async (
  databaseService: DatabaseService,
  params: { userId: string; removedBy: string },
): Promise<RemoveUserOutcome> => {
  const result = await databaseService.query<{ outcome: RemoveUserOutcome }>(
    'SELECT admin_remove_user($1, $2) AS outcome',
    [params.userId, params.removedBy],
  );
  return result.rows[0].outcome;
};
