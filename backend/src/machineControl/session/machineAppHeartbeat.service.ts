import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { Namespace, Socket } from 'socket.io';
import { DeviceSessionService, PairedDevice } from './deviceSession.service';
import { MACHINE_APP_EVENTS } from './machineAppEvents';

const HEARTBEAT_MS = 30 * 1000;
const SWEEP_MS = 60 * 1000;
// Three missed heartbeats: the container holding the socket is gone.
const STALE_SECONDS = 90;

// Keeps the session status honest across containers: every 30 seconds this
// container vouches for the sockets it holds, and every minute one container
// clears sockets nobody vouched for. Offline transport never revokes pairing.
@Injectable()
export class MachineAppHeartbeatService {
  private readonly logger = new Logger(MachineAppHeartbeatService.name);
  private namespace: Namespace | null = null;

  constructor(private readonly sessions: DeviceSessionService) {}

  attach = (namespace: Namespace): void => {
    this.namespace = namespace;
  };

  @Interval(HEARTBEAT_MS)
  async vouchForLocalSockets() {
    if (!this.namespace) return;
    const sockets: Socket[] = [...this.namespace.sockets.values()];
    // LISTEN/NOTIFY is transient. Revalidate after listener reconnection so
    // a missed end event cannot leave a revoked tablet socket alive forever.
    for (const socket of sockets) {
      const device = (socket.data as { device?: PairedDevice }).device;
      if (!device) continue;
      try {
        const valid = await this.sessions.isCurrentDevice(device);
        if (!valid) {
          socket.emit(MACHINE_APP_EVENTS.sessionEnded, {
            deviceId: device.deviceId,
            machineId: device.machineId,
            reason: null,
          });
          socket.disconnect(true);
        }
      } catch {
        this.logger.warn(
          'Tablet credential revalidation unavailable; retrying next heartbeat',
        );
      }
    }
    const liveSockets = sockets.filter((socket) => socket.connected);
    const deviceIds = liveSockets
      .map((socket) => (socket.data as { device?: PairedDevice }).device)
      .filter((device): device is PairedDevice => Boolean(device))
      .map((device) => device.deviceId);
    const socketIds = liveSockets.map((socket) => socket.id);
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
    // Keep the old argument for rolling-deploy signature compatibility.
    // Migration 0130 makes sweeps presence-only.
    const timeoutMinutes = 30;
    await this.sessions
      .sweep(STALE_SECONDS, timeoutMinutes)
      .catch((error: unknown) =>
        this.logger.warn(`Machine app sweep failed: ${String(error)}`),
      );
  }
}
