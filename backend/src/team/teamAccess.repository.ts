import { DatabaseService } from '../database/database.service';

// Whether a user belongs to the organisation (and isn't deleted). The
// shared admin services act on any user id, so the Team routes check this
// first.
export const isTeamMember = async (
  databaseService: DatabaseService,
  tenantId: string,
  userId: string,
): Promise<boolean> =>
  databaseService.withTenant(tenantId, async (client) => {
    const result = await client.query(
      'SELECT 1 FROM users WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL',
      [userId, tenantId],
    );
    return (result.rowCount ?? 0) > 0;
  });
