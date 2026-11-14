import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Namespace } from 'socket.io';
import { PgChannelListener } from '../database/pgChannelListener';
import {
  NOTIFICATION_EVENTS,
  NOTIFICATION_PG_CHANNEL,
  userRoom,
} from './notificationEvents';
import { PushSenderService } from './push/pushSender.service';

// LISTENs for new notifications (migration 0065's trigger, which covers
// alerts and the 0054 triggers alike), forwards each to its user's socket
// room and hands it to the push sender. Starts once the gateway attaches
// its namespace.
@Injectable()
export class NotificationListenerService implements OnModuleDestroy {
  private readonly logger = new Logger(NotificationListenerService.name);
  private namespace: Namespace | null = null;
  private listener: PgChannelListener | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly pushSender: PushSenderService,
  ) {}

  attach = (namespace: Namespace): void => {
    this.namespace = namespace;
    this.listener = new PgChannelListener(
      this.configService.getOrThrow<string>('DATABASE_URL'),
      NOTIFICATION_PG_CHANNEL,
      this.forward,
      this.logger,
    );
    this.listener.start();
  };

  onModuleDestroy = async () => {
    await this.listener?.stop();
  };

  private forward = (payload: string): void => {
    try {
      const { userId, notificationId } = JSON.parse(payload) as {
        userId: string;
        notificationId: string;
      };
      this.namespace
        ?.to(userRoom(userId))
        .emit(NOTIFICATION_EVENTS.created, { notificationId });
      // Every container hears this; claim_notification_push() lets only
      // one of them push it. Fire and forget: the sender logs its errors.
      void this.pushSender.sendForNotification(notificationId);
    } catch (error) {
      this.logger.warn(`Bad notification payload: ${String(error)}`);
    }
  };
}
