import { PoolClient } from 'pg';
import { DEFAULT_COOLDOWN_MINUTES, NewAlertRule } from './defaultAlertRules';
import { UpdateChannelsDto } from './dto/updateChannelsDto';
import { AlertRuleRow, ChannelSettingsRow } from './types/notificationRows';

// Every query runs inside withTenant(): RLS scopes it to the tenant, and
// tenant_id is also matched explicitly.
const RULE_COLUMNS = `id, name, trigger_type, trigger_params, audiences, channels,
  is_enabled, cooldown_minutes, created_at, updated_at`;

// True the first time — i.e. when the organisation's defaults should be
// created. The primary key makes this safe against two first visits.
export const insertChannelSettingsIfMissing = async (
  client: PoolClient,
  tenantId: string,
): Promise<boolean> => {
  const result = await client.query(
    `INSERT INTO notification_channel_settings (tenant_id) VALUES ($1)
     ON CONFLICT (tenant_id) DO NOTHING`,
    [tenantId],
  );
  return (result.rowCount ?? 0) > 0;
};

export const findChannelSettings = async (
  client: PoolClient,
  tenantId: string,
): Promise<ChannelSettingsRow> => {
  const result = await client.query<ChannelSettingsRow>(
    `SELECT push_enabled, email_enabled, sms_enabled
     FROM notification_channel_settings WHERE tenant_id = $1`,
    [tenantId],
  );
  return result.rows[0];
};

export const updateChannelSettings = async (
  client: PoolClient,
  tenantId: string,
  channels: UpdateChannelsDto,
): Promise<void> => {
  await client.query(
    `UPDATE notification_channel_settings
     SET push_enabled = COALESCE($2, push_enabled),
         email_enabled = COALESCE($3, email_enabled),
         sms_enabled = COALESCE($4, sms_enabled)
     WHERE tenant_id = $1`,
    [
      tenantId,
      channels.push ?? null,
      channels.email ?? null,
      channels.sms ?? null,
    ],
  );
};

export const listAlertRules = async (
  client: PoolClient,
  tenantId: string,
): Promise<AlertRuleRow[]> => {
  const result = await client.query<AlertRuleRow>(
    `SELECT ${RULE_COLUMNS} FROM alert_rules
     WHERE tenant_id = $1 AND deleted_at IS NULL
     ORDER BY sort_order, created_at`,
    [tenantId],
  );
  return result.rows;
};

// A duplicate live name raises a unique violation (23505).
export const insertAlertRule = async (
  client: PoolClient,
  params: { tenantId: string; createdBy: string | null; rule: NewAlertRule },
): Promise<AlertRuleRow> => {
  const { rule } = params;
  const result = await client.query<AlertRuleRow>(
    `INSERT INTO alert_rules (tenant_id, name, trigger_type, trigger_params, audiences,
       channels, is_enabled, created_by, cooldown_minutes, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9,
       (SELECT COALESCE(max(sort_order), 0) + 1 FROM alert_rules WHERE tenant_id = $1))
     RETURNING ${RULE_COLUMNS}`,
    [
      params.tenantId,
      rule.name,
      rule.triggerType,
      rule.triggerParams,
      rule.audiences,
      rule.channels,
      rule.isEnabled,
      params.createdBy,
      rule.cooldownMinutes ?? DEFAULT_COOLDOWN_MINUTES,
    ],
  );
  return result.rows[0];
};

// Undefined when there's no such live rule in this organisation.
export const replaceAlertRule = async (
  client: PoolClient,
  params: { tenantId: string; ruleId: string; rule: NewAlertRule },
): Promise<AlertRuleRow | undefined> => {
  const { rule } = params;
  const result = await client.query<AlertRuleRow>(
    `UPDATE alert_rules
     SET name = $3, trigger_type = $4, trigger_params = $5, audiences = $6,
         channels = $7, is_enabled = $8, cooldown_minutes = $9
     WHERE id = $2 AND tenant_id = $1 AND deleted_at IS NULL
     RETURNING ${RULE_COLUMNS}`,
    [
      params.tenantId,
      params.ruleId,
      rule.name,
      rule.triggerType,
      rule.triggerParams,
      rule.audiences,
      rule.channels,
      rule.isEnabled,
      rule.cooldownMinutes ?? DEFAULT_COOLDOWN_MINUTES,
    ],
  );
  return result.rows[0];
};

export const setAlertRuleEnabled = async (
  client: PoolClient,
  params: { tenantId: string; ruleId: string; isEnabled: boolean },
): Promise<AlertRuleRow | undefined> => {
  const result = await client.query<AlertRuleRow>(
    `UPDATE alert_rules SET is_enabled = $3
     WHERE id = $2 AND tenant_id = $1 AND deleted_at IS NULL
     RETURNING ${RULE_COLUMNS}`,
    [params.tenantId, params.ruleId, params.isEnabled],
  );
  return result.rows[0];
};

export const softDeleteAlertRule = async (
  client: PoolClient,
  params: { tenantId: string; ruleId: string },
): Promise<AlertRuleRow | undefined> => {
  const result = await client.query<AlertRuleRow>(
    `UPDATE alert_rules SET deleted_at = now()
     WHERE id = $2 AND tenant_id = $1 AND deleted_at IS NULL
     RETURNING ${RULE_COLUMNS}`,
    [params.tenantId, params.ruleId],
  );
  return result.rows[0];
};
