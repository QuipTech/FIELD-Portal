import { Logger } from '@nestjs/common';
import { Client, Notification } from 'pg';
import { buildPoolConfig } from './buildPoolConfig';

const RECONNECT_DELAY_MS = 5000;

// One dedicated database connection that LISTENs on a channel and hands
// each payload on; reconnects if the connection drops. Every API container
// runs its own, so each hears every event.
export class PgChannelListener {
  private client: Client | null = null;
  private isStopped = false;

  constructor(
    private readonly databaseUrl: string,
    private readonly channel: string,
    private readonly onPayload: (payload: string) => void,
    private readonly logger: Logger,
  ) {}

  start = (): void => {
    this.isStopped = false;
    void this.connect();
  };

  stop = async (): Promise<void> => {
    this.isStopped = true;
    await this.client?.end().catch(() => undefined);
  };

  private connect = async (): Promise<void> => {
    if (this.isStopped) return;
    const client = new Client(buildPoolConfig(this.databaseUrl));
    client.on('notification', (message: Notification) => {
      if (message.payload) this.onPayload(message.payload);
    });
    client.on('error', (error) => this.reconnect(client, error));
    try {
      await client.connect();
      await client.query(`LISTEN ${this.channel}`);
      this.client = client;
    } catch (error) {
      this.reconnect(client, error);
    }
  };

  private reconnect = (client: Client, error: unknown): void => {
    this.logger.warn(`Listener on ${this.channel} lost: ${String(error)}`);
    client.removeAllListeners();
    void client.end().catch(() => undefined);
    if (this.client === client) this.client = null;
    if (!this.isStopped)
      setTimeout(() => void this.connect(), RECONNECT_DELAY_MS);
  };
}
