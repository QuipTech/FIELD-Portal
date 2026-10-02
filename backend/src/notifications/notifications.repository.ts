import { PoolClient } from 'pg';
import { NotificationRow } from './types/notificationRows';

// A user only ever sees their own notifications. Every query filters on
// tenant_id as well as relying on RLS, since the backend's database role
// may bypass RLS. Rows are written by triggers (migration 0054).

export const listNotifications = async (
  client: PoolClient,
  params: {
    tenantId: string;
    userId: string;
    unreadOnly: boolean;
    limit: number;
    // Paging: rows created before this time.
    before: Date | null;
  },
): Promise<NotificationRow[]> => {
  const result = await client.query<NotificationRow>(
    `SELECT id, kind, title, body, link, created_at, read_at
     FROM notifications
     WHERE tenant_id = $1 AND user_id = $2
       AND ($3::boolean IS FALSE OR read_at IS NULL)
       AND ($5::timestamptz IS NULL OR created_at < $5)
     ORDER BY created_at DESC
     LIMIT $4`,
    [
      params.tenantId,
      params.userId,
      params.unreadOnly,
      params.limit,
      params.before,
    ],
  );
  return result.rows;
};

export const countUnread = async (
  client: PoolClient,
  params: { tenantId: string; userId: string },
): Promise<number> => {
  const result = await client.query<{ count: string }>(
    `SELECT count(*) FROM notifications
     WHERE tenant_id = $1 AND user_id = $2 AND read_at IS NULL`,
    [params.tenantId, params.userId],
  );
  return Number(result.rows[0].count);
};

// False when there's no such notification for this user.
export const markRead = async (
  client: PoolClient,
  params: { tenantId: string; userId: string; notificationId: string },
): Promise<boolean> => {
  const result = await client.query(
    `UPDATE notifications SET read_at = COALESCE(read_at, now())
     WHERE id = $1 AND tenant_id = $2 AND user_id = $3`,
    [params.notificationId, params.tenantId, params.userId],
  );
  return (result.rowCount ?? 0) > 0;
};

export const markAllRead = async (
  client: PoolClient,
  params: { tenantId: string; userId: string },
): Promise<void> => {
  await client.query(
    `UPDATE notifications SET read_at = now()
     WHERE tenant_id = $1 AND user_id = $2 AND read_at IS NULL`,
    [params.tenantId, params.userId],
  );
};
