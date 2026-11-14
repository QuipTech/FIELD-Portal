import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import { Namespace, Socket } from 'socket.io';
import { DeviceSessionService, PairedDevice } from './deviceSession.service';

const HEARTBEAT_MS = 30 * 1000;
const SWEEP_MS = 60 * 1000;
// Three missed heartbeats: the container holding the socket is gone.
const STALE_SECONDS = 90;
const DEFAULT_TIMEOUT_MINUTES = 30;

// Keeps the session status honest across containers: every 30 seconds this
// container vouches for the sockets it holds, and every minute one container
// clears sockets nobody vouched for and ends sessions whose tablet has been
// offline longer than MC_SESSION_PENDING_TIMEOUT_MINUTES.
@Injectable()
export class MachineAppHeartbeatService {
  private readonly logger = new Logger(MachineAppHeartbeatService.name);
  private namespace: Namespace | null = null;

  constructor(
    private readonly sessions: DeviceSessionService,
    private readonly configService: ConfigService,
  ) {}

  attach = (namespace: Namespace): void => {
    this.namespace = namespace;
  };

  @Interval(HEARTBEAT_MS)
  async vouchForLocalSockets() {
    if (!this.namespace) return;
    const sockets: Socket[] = [...this.namespace.sockets.values()];
    const deviceIds = sockets
      .map((socket) => (socket.data as { device?: PairedDevice }).device)
      .filter((device): device is PairedDevice => Boolean(device))
      .map((device) => device.deviceId);
    const socketIds = sockets.map((socket) => socket.id);
    if (socketIds.length === 0) return;
    await this.sessions
      .touchLiveSockets(deviceIds, socketIds)
      .catch((error: unknown) =>
        this.logger.warn(`Machine app heartbeat failed: ${String(error)}`),
      );
  }

  @Interval(SWEEP_MS)
  async sweepStaleSessions() {
    if (!this.namespace) return;
    const timeoutMinutes = Number(
      this.configService.get('MC_SESSION_PENDING_TIMEOUT_MINUTES') ??
        DEFAULT_TIMEOUT_MINUTES,
    );
    await this.sessions
      .sweep(STALE_SECONDS, timeoutMinutes)
      .catch((error: unknown) =>
        this.logger.warn(`Machine app sweep failed: ${String(error)}`),
      );
  }
}
