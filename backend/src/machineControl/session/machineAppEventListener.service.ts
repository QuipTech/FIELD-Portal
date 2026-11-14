import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Namespace } from 'socket.io';
import { PgChannelListener } from '../../database/pgChannelListener';
import {
  deviceRoom,
  MACHINE_APP_EVENTS,
  MachineAppEvent,
  machineWatchRoom,
  MC_DEVICE_PG_CHANNEL,
} from './machineAppEvents';

// Hears every session change (migration 0128) and tells both sides: the
// portal people watching that machine, and, when the session ends, the
// tablet itself, which is then signed off the socket.
@Injectable()
export class MachineAppEventListenerService implements OnModuleDestroy {
  private readonly logger = new Logger(MachineAppEventListenerService.name);
  private namespace: Namespace | null = null;
  private listener: PgChannelListener | null = null;

  constructor(private readonly configService: ConfigService) {}

  attach = (namespace: Namespace): void => {
    this.namespace = namespace;
    this.listener = new PgChannelListener(
      this.configService.getOrThrow<string>('DATABASE_URL'),
      MC_DEVICE_PG_CHANNEL,
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
      const { event, ...body } = JSON.parse(payload) as MachineAppEvent;
      const { deviceId, machineId } = body;
      this.namespace?.to(machineWatchRoom(machineId)).emit(event, body);
      if (event !== MACHINE_APP_EVENTS.sessionStarted) {
        this.namespace?.to(deviceRoom(deviceId)).emit(event, body);
      }
      if (event === MACHINE_APP_EVENTS.sessionEnded) {
        // A plain disconnect goes out after the event, so the tablet gets both.
        this.namespace?.in(deviceRoom(deviceId)).disconnectSockets();
      }
    } catch (error) {
      this.logger.warn(`Bad machine app event: ${String(error)}`);
    }
  };
}
