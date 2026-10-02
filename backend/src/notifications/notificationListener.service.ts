import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client, Notification } from 'pg';
import { Namespace } from 'socket.io';
import { buildPoolConfig } from '../database/buildPoolConfig';
import {
  NOTIFICATION_EVENTS,
  NOTIFICATION_PG_CHANNEL,
  userRoom,
} from './notificationEvents';

const RECONNECT_DELAY_MS = 5000;

// Holds one dedicated database connection that LISTENs for new
// notifications (migration 0065's trigger, which covers alerts and the
// 0054 triggers alike) and forwards each to its user's socket room. Starts
// once the gateway attaches its namespace; reconnects if the connection
// drops.
@Injectable()
export class NotificationListenerService implements OnModuleDestroy {
  private readonly logger = new Logger(NotificationListenerService.name);
  private namespace: Namespace | null = null;
  private client: Client | null = null;
  private isStopped = false;

  constructor(private readonly configService: ConfigService) {}

  attach = (namespace: Namespace): void => {
    this.namespace = namespace;
    void this.connect();
  };

  onModuleDestroy = async () => {
    this.isStopped = true;
    await this.client?.end().catch(() => undefined);
  };

  private connect = async (): Promise<void> => {
    if (this.isStopped) return;
    const client = new Client(
      buildPoolConfig(this.configService.getOrThrow<string>('DATABASE_URL')),
    );
    client.on('notification', this.forward);
    client.on('error', (error) => this.reconnect(client, error));
    try {
      await client.connect();
      await client.query(`LISTEN ${NOTIFICATION_PG_CHANNEL}`);
      this.client = client;
    } catch (error) {
      this.reconnect(client, error);
    }
  };

  private reconnect = (client: Client, error: unknown): void => {
    this.logger.warn(`Notification listener lost: ${String(error)}`);
    client.removeAllListeners();
    void client.end().catch(() => undefined);
    if (this.client === client) this.client = null;
    if (!this.isStopped)
      setTimeout(() => void this.connect(), RECONNECT_DELAY_MS);
  };

  private forward = (message: Notification): void => {
    if (!message.payload) return;
    try {
      const { userId, notificationId } = JSON.parse(message.payload) as {
        userId: string;
        notificationId: string;
      };
      this.namespace
        ?.to(userRoom(userId))
        .emit(NOTIFICATION_EVENTS.created, { notificationId });
    } catch (error) {
      this.logger.warn(`Bad notification payload: ${String(error)}`);
    }
  };
}
