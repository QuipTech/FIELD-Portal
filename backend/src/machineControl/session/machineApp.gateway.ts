import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { isUUID } from 'class-validator';
import { Namespace, Socket } from 'socket.io';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { verifySocketToken } from '../../common/security/verifySocketToken';
import { MachineAppPairingService } from '../pairing/machineAppPairing.service';
import { DeviceSessionService, PairedDevice } from './deviceSession.service';
import { MachineAppEventListenerService } from './machineAppEventListener.service';
import {
  DEVICE_TOKEN_REVOKED,
  deviceRoom,
  machineWatchRoom,
} from './machineAppEvents';
import { MachineAppHeartbeatService } from './machineAppHeartbeat.service';

const UNAUTHORIZED_MESSAGE = 'unauthorized';
const NOT_FOUND_REPLY = { ok: false, error: 'not_found' };

interface SocketData {
  device?: PairedDevice;
  actor?: AuthenticatedUser;
}

const readMachineId = (body: { machineId?: unknown }): string | null =>
  typeof body?.machineId === 'string' && isUUID(body.machineId)
    ? body.machineId
    : null;

// The live session at /machine-app (Socket.IO). The tablet connects with
// `auth.deviceToken`; a portal person with `auth.token` and then `watch`es
// a machine. Socket.IO's own ping/pong notices either side dropping, which
// makes the session 'pending'; every change reaches both sides through the
// database (machineAppEventListener.service.ts).
@WebSocketGateway({ namespace: '/machine-app' })
export class MachineAppGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(MachineAppGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly sessions: DeviceSessionService,
    private readonly pairing: MachineAppPairingService,
    private readonly events: MachineAppEventListenerService,
    private readonly heartbeat: MachineAppHeartbeatService,
  ) {}

  // A refused tablet gets connect_error DEVICE_TOKEN_REVOKED; a refused
  // portal person gets "unauthorized".
  afterInit = (namespace: Namespace) => {
    this.events.attach(namespace);
    this.heartbeat.attach(namespace);
    namespace.use((socket, next) => {
      this.authenticate(socket)
        .then((error) => next(error))
        .catch((error: unknown) => {
          this.logger.warn(`Machine app socket auth failed: ${String(error)}`);
          next(new Error(UNAUTHORIZED_MESSAGE));
        });
    });
  };

  handleConnection = async (socket: Socket) => {
    const { device } = socket.data as SocketData;
    if (!device) return;
    await socket.join(deviceRoom(device.deviceId));
    await this.sessions.setTabletOnline(device.deviceId, socket.id, true);
  };

  // A tablet going offline, or a portal person leaving, makes the session
  // pending. After our own disconnect of an ended session nothing happens.
  handleDisconnect = async (socket: Socket) => {
    const { device, actor } = socket.data as SocketData;
    const work = device
      ? this.sessions.setTabletOnline(device.deviceId, socket.id, false)
      : actor
        ? this.sessions.unwatch(socket.id, null)
        : Promise.resolve();
    await work.catch((error: unknown) =>
      this.logger.warn(`Machine app disconnect failed: ${String(error)}`),
    );
  };

  // The reply says where the machine stands right now; events follow.
  @SubscribeMessage('watch')
  async watch(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { machineId?: unknown },
  ) {
    const { actor } = socket.data as SocketData;
    const machineId = readMachineId(body);
    if (!actor || !machineId) return NOT_FOUND_REPLY;
    const allowed = await this.pairing
      .getConnection(actor, machineId)
      .then(() => true)
      .catch(() => false);
    if (!allowed) return NOT_FOUND_REPLY;
    await socket.join(machineWatchRoom(machineId));
    await this.sessions.watch(socket.id, machineId);
    return {
      ok: true,
      ...(await this.pairing.getConnection(actor, machineId)),
    };
  }

  @SubscribeMessage('unwatch')
  async unwatch(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { machineId?: unknown },
  ) {
    const machineId = readMachineId(body);
    if (machineId) {
      await socket.leave(machineWatchRoom(machineId));
      await this.sessions.unwatch(socket.id, machineId);
    }
    return { ok: true };
  }

  private authenticate = async (socket: Socket): Promise<Error | undefined> => {
    const data = socket.data as SocketData;
    const deviceToken: unknown = socket.handshake.auth?.deviceToken;
    if (typeof deviceToken === 'string' && deviceToken) {
      const device = await this.sessions.authenticate(deviceToken);
      if (!device) return new Error(DEVICE_TOKEN_REVOKED);
      data.device = device;
      return undefined;
    }
    const payload = await verifySocketToken(
      socket,
      this.jwtService,
      this.configService.getOrThrow<string>('JWT_SECRET'),
    );
    if (!payload) return new Error(UNAUTHORIZED_MESSAGE);
    data.actor = {
      userId: payload.sub,
      tenantId: payload.tenantId,
      email: payload.email,
    };
    return undefined;
  };
}
