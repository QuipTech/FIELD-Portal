import { ServiceDatabaseService } from '../../database/serviceDatabase.service';

export interface BillingConfigRow {
  key: string;
  value: unknown;
  is_final: boolean;
  description: string;
  updated_at: Date;
}

// billing.* is service role only (migrations 0094, 0095).
export const listBillingConfigRows = async (
  serviceDatabase: ServiceDatabaseService,
): Promise<BillingConfigRow[]> => {
  const result = await serviceDatabase.query<BillingConfigRow>(
    `SELECT key, value, is_final, description, updated_at
     FROM billing.config
     WHERE deleted_at IS NULL
     ORDER BY key`,
  );
  return result.rows;
};

// One value, already validated against its key's kind by the caller.
// Returns the previous value, or undefined when the key doesn't exist.
export const updateBillingConfigValue = async (
  client: Pick<ServiceDatabaseService, 'query'>,
  key: string,
  value: unknown,
): Promise<{ previous: unknown } | undefined> => {
  const result = await client.query<{ previous: unknown }>(
    `UPDATE billing.config c SET value = $2::jsonb, updated_at = now()
     FROM (SELECT key, value AS previous FROM billing.config WHERE key = $1 FOR UPDATE) old
     WHERE c.key = old.key AND c.deleted_at IS NULL
     RETURNING old.previous`,
    [key, JSON.stringify(value)],
  );
  return result.rows[0];
};
