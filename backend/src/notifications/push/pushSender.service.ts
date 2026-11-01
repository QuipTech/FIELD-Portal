import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import * as devicesRepository from '../devices/pushDevices.repository';
import { PushConfig } from './pushConfig';
import { buildPushMessage } from './pushPlatform';
import { SnsPushService } from './snsPush.service';

interface ClaimedNotification {
  tenant_id: string;
  user_id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string;
  unread_count: string;
  push_allowed: boolean;
}

// Pushes a new in-app notification (the same item /notifications returns)
// to each of the person's devices. Runs in the background, from the
// listener that hears about new notifications — never inside the request
// that created one. Each notification is claimed once across every API
// container (claim_notification_push(), migration 0112), and the person's
// push preferences (push off, muted kinds) are respected. One device
// failing never stops the others.
@Injectable()
export class PushSenderService {
  private readonly logger = new Logger(PushSenderService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly config: PushConfig,
    private readonly sns: SnsPushService,
  ) {}

  sendForNotification = async (notificationId: string): Promise<void> => {
    try {
      await this.send(notificationId);
    } catch (error) {
      this.logger.error(
        `Push for notification ${notificationId} failed: ${String(error)}`,
      );
    }
  };

  private send = async (notificationId: string): Promise<void> => {
    const claimed = await this.databaseService.query<ClaimedNotification>(
      'SELECT * FROM claim_notification_push($1)',
      [notificationId],
    );
    const notification = claimed.rows[0];
    if (!notification?.push_allowed) return;
    const scope = {
      tenantId: notification.tenant_id,
      userId: notification.user_id,
    };
    const devices = await this.databaseService.withTenant(
      scope.tenantId,
      (client) => devicesRepository.listPushableDevices(client, scope),
    );
    for (const device of devices) {
      const message = buildPushMessage(
        {
          id: notificationId,
          kind: notification.kind,
          title: notification.title,
          body: notification.body,
          link: notification.link,
        },
        Number(notification.unread_count),
        {
          deviceType: device.device_type,
          apnsEnvironment: device.apns_environment,
        },
      );
      if (!this.config.isSendingEnabled) {
        this.logger.log(
          `[NOTIFICATIONS_ENABLED is off] Would push "${notification.title}" to device ${device.id}`,
        );
        continue;
      }
      await this.deliver(notificationId, scope.tenantId, device, message);
    }
  };

  private deliver = async (
    notificationId: string,
    tenantId: string,
    device: devicesRepository.PushDeviceRow,
    message: string,
  ) => {
    let status: 'sent' | 'failed' = 'failed';
    let messageId: string | null = null;
    let error: string | null = null;
    try {
      const outcome = await this.sns.publish(device.endpoint_arn!, message);
      if (outcome.status === 'sent') {
        status = 'sent';
        messageId = outcome.messageId;
      } else {
        error = outcome.error;
        await this.databaseService.withTenant(tenantId, (client) =>
          outcome.status === 'disabled'
            ? devicesRepository.markDeviceDisabled(client, {
                tenantId,
                deviceId: device.id,
              })
            : devicesRepository.deleteDeviceById(client, {
                tenantId,
                deviceId: device.id,
              }),
        );
      }
    } catch (cause) {
      error = String(cause);
      this.logger.warn(`Push to device ${device.id} failed: ${error}`);
    }
    await this.databaseService.withTenant(tenantId, (client) =>
      client.query('SELECT alert_record_delivery($1, $2, $3, $4, $5)', [
        notificationId,
        'push',
        status,
        messageId,
        error,
      ]),
    );
  };
}
