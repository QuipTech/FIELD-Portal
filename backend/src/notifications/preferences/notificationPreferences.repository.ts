import { PoolClient } from 'pg';

export interface NotificationPreferencesRow {
  push_enabled: boolean;
  email_enabled: boolean;
  muted_kinds: string[];
}

// The caller's own preferences; null until they first save them. Run
// inside withTenant(caller).
export const findNotificationPreferences = async (
  client: PoolClient,
  params: { tenantId: string; userId: string },
): Promise<NotificationPreferencesRow | null> => {
  const result = await client.query<NotificationPreferencesRow>(
    `SELECT push_enabled, email_enabled, muted_kinds FROM user_notification_preferences
     WHERE user_id = $1 AND tenant_id = $2`,
    [params.userId, params.tenantId],
  );
  return result.rows[0] ?? null;
};

export const saveNotificationPreferences = async (
  client: PoolClient,
  params: {
    tenantId: string;
    userId: string;
    pushEnabled: boolean;
    emailEnabled: boolean;
    mutedKinds: string[];
  },
): Promise<NotificationPreferencesRow> => {
  const result = await client.query<NotificationPreferencesRow>(
    `INSERT INTO user_notification_preferences (user_id, tenant_id, push_enabled, email_enabled, muted_kinds)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id) DO UPDATE
       SET push_enabled = EXCLUDED.push_enabled, email_enabled = EXCLUDED.email_enabled,
           muted_kinds = EXCLUDED.muted_kinds, updated_at = now()
     RETURNING push_enabled, email_enabled, muted_kinds`,
    [
      params.userId,
      params.tenantId,
      params.pushEnabled,
      params.emailEnabled,
      params.mutedKinds,
    ],
  );
  return result.rows[0];
};
