import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { runAuditedChange } from '../common/audit/runAuditedChange';
import * as notificationsRepository from './notifications.repository';
import { toAlertRule, toDeliveryChannels } from './alertRuleRules';
import { DEFAULT_ALERT_RULES } from './defaultAlertRules';
import {
  ALERT_AUDIENCES,
  ALERT_CHANNELS,
  ALERT_TRIGGER_TYPES,
} from './alertTriggerCatalog';
import { UpdateChannelsDto } from './dto/updateChannelsDto';
import {
  DeliveryChannels,
  NotificationSettings,
} from './types/notificationResponse';

const describeChannels = (channels: DeliveryChannels) =>
  ALERT_CHANNELS.map(
    (channel) => `${channel.label} ${channels[channel.value] ? 'on' : 'off'}`,
  ).join(' · ');

// The signed-in admin's own organisation's notification settings.
// The rule engine (src/alertEngine) evaluates what's saved here.
@Injectable()
export class NotificationSettingsService {
  constructor(private readonly databaseService: DatabaseService) {}

  getSettings = (actor: AuthenticatedUser): Promise<NotificationSettings> =>
    this.databaseService.withTenant(actor.tenantId, async (client) => {
      await ensureNotificationDefaults(client, actor);
      return loadSettings(client, actor.tenantId);
    });

  updateChannels = async (
    actor: AuthenticatedUser,
    dto: UpdateChannelsDto,
  ): Promise<NotificationSettings> => {
    const channels = await runAuditedChange(
      this.databaseService,
      actor,
      '',
      async (client) => {
        await ensureNotificationDefaults(client, actor);
        await notificationsRepository.updateChannelSettings(
          client,
          actor.tenantId,
          dto,
        );
        const updated = toDeliveryChannels(
          await notificationsRepository.findChannelSettings(
            client,
            actor.tenantId,
          ),
        );
        const audit = {
          action: 'update' as const,
          entityType: 'notification_channels',
          entityId: actor.tenantId,
          metadata: { name: describeChannels(updated), change: { ...dto } },
        };
        return { result: updated, audit };
      },
    );
    return { ...(await this.getSettings(actor)), channels };
  };

  // The trigger catalog for the "New rule" form (describe() stays server-side).
  getOptions = () => ({
    triggerTypes: ALERT_TRIGGER_TYPES.map(({ type, label, fields }) => ({
      type,
      label,
      fields,
    })),
    audiences: ALERT_AUDIENCES,
    channels: ALERT_CHANNELS,
  });
}

// First visit: the channel settings row is created and the default rules
// with it. Later visits find the row and leave the rules alone.
export const ensureNotificationDefaults = async (
  client: PoolClient,
  actor: AuthenticatedUser,
): Promise<void> => {
  const isFirstVisit =
    await notificationsRepository.insertChannelSettingsIfMissing(
      client,
      actor.tenantId,
    );
  if (!isFirstVisit) return;
  for (const rule of DEFAULT_ALERT_RULES) {
    await notificationsRepository.insertAlertRule(client, {
      tenantId: actor.tenantId,
      createdBy: null,
      rule,
    });
  }
};

export const loadSettings = async (
  client: PoolClient,
  tenantId: string,
): Promise<NotificationSettings> => {
  const channels = toDeliveryChannels(
    await notificationsRepository.findChannelSettings(client, tenantId),
  );
  const rows = await notificationsRepository.listAlertRules(client, tenantId);
  return { rules: rows.map((row) => toAlertRule(row, channels)), channels };
};
