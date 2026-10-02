import { DatabaseService } from '../database/database.service';
import { RecipientCandidateRow, TenantBrandingRow } from './types/alertRows';
import { DeliveryChannelName, DeliveryResult } from './types/alertTypes';

export const listRecipientCandidates = async (
  databaseService: DatabaseService,
  params: { tenantId: string; machineId: string | null; caseId: string | null },
): Promise<RecipientCandidateRow[]> => {
  const result = await databaseService.query<RecipientCandidateRow>(
    `SELECT * FROM alert_list_recipient_candidates($1, $2, $3)`,
    [params.tenantId, params.machineId, params.caseId],
  );
  return result.rows;
};

// The new notification's id, or null while the rule's cooldown holds for
// this user and entity (or the user isn't in the organisation).
export const recordNotification = async (
  databaseService: DatabaseService,
  params: {
    tenantId: string;
    userId: string;
    ruleId: string;
    entityKey: string;
    cooldownMinutes: number;
    title: string;
    body: string;
    link: string;
  },
): Promise<string | null> => {
  const result = await databaseService.query<{ id: string | null }>(
    `SELECT alert_record_notification($1, $2, $3, $4, $5, $6, $7, $8) AS id`,
    [
      params.tenantId,
      params.userId,
      params.ruleId,
      params.entityKey,
      params.cooldownMinutes,
      params.title,
      params.body,
      params.link,
    ],
  );
  return result.rows[0]?.id ?? null;
};

export const recordDelivery = async (
  databaseService: DatabaseService,
  params: {
    notificationId: string;
    channel: DeliveryChannelName;
    result: DeliveryResult;
  },
): Promise<void> => {
  await databaseService.query(
    `SELECT alert_record_delivery($1, $2, $3, $4, $5)`,
    [
      params.notificationId,
      params.channel,
      params.result.status,
      params.result.providerMessageId ?? null,
      params.result.error ?? null,
    ],
  );
};

// tenants has no RLS; pinned to the rule's organisation.
export const findTenantBranding = async (
  databaseService: DatabaseService,
  tenantId: string,
): Promise<TenantBrandingRow | undefined> => {
  const result = await databaseService.query<TenantBrandingRow>(
    `SELECT name, branding_color_accent, branding_color_primary
     FROM tenants WHERE id = $1 AND deleted_at IS NULL`,
    [tenantId],
  );
  return result.rows[0];
};
