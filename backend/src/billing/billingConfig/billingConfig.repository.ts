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
