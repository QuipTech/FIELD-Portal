import { DatabaseService } from '../database/database.service';

// Emails whose accounts an admin removed (migration 0077). Platform data,
// read before there is a tenant.

export const isRemovedAccount = async (
  databaseService: DatabaseService,
  email: string,
): Promise<boolean> => {
  const result = await databaseService.query(
    'SELECT 1 FROM removed_accounts WHERE email = lower($1)',
    [email],
  );
  return (result.rowCount ?? 0) > 0;
};

// Re-invited: they can sign in again.
export const clearRemovedAccount = async (
  databaseService: DatabaseService,
  email: string,
): Promise<void> => {
  await databaseService.query(
    'DELETE FROM removed_accounts WHERE email = lower($1)',
    [email],
  );
};
