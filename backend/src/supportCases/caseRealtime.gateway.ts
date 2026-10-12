import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { Namespace, Socket } from 'socket.io';
import {
  agentRoom,
  CASE_EVENTS,
  CaseEventsPublisher,
  caseRoom,
  caseStaffRoom,
  SUPPORT_ADMINS_ROOM,
  tenantRoom,
} from './caseEventsPublisher';
import {
  CaseSocketAuthenticator,
  CaseSocketUser,
} from './caseSocketAuthenticator';
import { CaseAccessService } from './caseAccess.service';
import { isSupportAdmin } from './caseAccessPolicy';

interface CaseRoomRequest {
  caseNumber?: unknown;
  // Typing an internal note: only staff are told.
  isInternal?: unknown;
}

type RoomAck = { ok: true } | { ok: false; error: string };

const toCaseNumber = (body: CaseRoomRequest | undefined): number | null => {
  const value = Number(body?.caseNumber);
  return Number.isInteger(value) && value > 0 ? value : null;
};

const UNAUTHORIZED_MESSAGE = 'unauthorized';
const UNKNOWN_CASE_MESSAGE = 'Unknown case.';

const socketUser = (socket: Socket) =>
  socket.data.user as CaseSocketUser | undefined;

// Live support-case chat at /support-cases (Socket.IO). On connect a
// portal joins its organisation's room (cases list), and staff the queue
// rooms. `case:join` adds a case's room — and, for its staff, the
// staff-only room where internal notes go — after the same access check
// as the REST routes. Messages are sent over REST; this only delivers.
@WebSocketGateway({ namespace: '/support-cases' })
export class CaseRealtimeGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly logger = new Logger(CaseRealtimeGateway.name);

  constructor(
    private readonly caseSocketAuthenticator: CaseSocketAuthenticator,
    private readonly caseEventsPublisher: CaseEventsPublisher,
    private readonly caseAccessService: CaseAccessService,
  ) {}

  // The token is checked in middleware, before the connection is accepted:
  // checking it in handleConnection would race the client's first event.
  // A refused client gets connect_error "unauthorized".
  afterInit = (namespace: Namespace) => {
    this.caseEventsPublisher.attach(namespace);
    namespace.use((socket, next) => {
      this.caseSocketAuthenticator
        .authenticate(socket)
        .then((user) => {
          if (!user) return next(new Error(UNAUTHORIZED_MESSAGE));
          socket.data.user = user;
          next();
        })
        .catch((error: unknown) => {
          this.logger.warn(`Case socket auth failed: ${String(error)}`);
          next(new Error(UNAUTHORIZED_MESSAGE));
        });
    });
  };

  handleConnection = async (socket: Socket) => {
    const user = socketUser(socket);
    if (!user) return;
    const rooms = [tenantRoom(user.tenantId)];
    if (isSupportAdmin(user.permissions)) rooms.push(SUPPORT_ADMINS_ROOM);
    if (user.isStaff) {
      rooms.push(agentRoom(user.userId));
    }
    await socket.join(rooms);
  };

  // Handlers are methods, not arrow properties: Nest's message and
  // parameter decorators only work on methods.
  @SubscribeMessage('case:join')
  async joinCase(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: CaseRoomRequest,
  ): Promise<RoomAck> {
    const user = socketUser(socket);
    const caseNumber = toCaseNumber(body);
    if (!user || caseNumber === null) {
      return { ok: false, error: UNKNOWN_CASE_MESSAGE };
    }
    const access = await this.caseAccessService.resolveAccess(user, caseNumber);
    if (!access) return { ok: false, error: UNKNOWN_CASE_MESSAGE };
    await socket.join(
      access.role === 'customer'
        ? [caseRoom(caseNumber)]
        : [caseRoom(caseNumber), caseStaffRoom(caseNumber)],
    );
    return { ok: true };
  }

  @SubscribeMessage('case:leave')
  async leaveCase(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: CaseRoomRequest,
  ): Promise<RoomAck> {
    const caseNumber = toCaseNumber(body);
    if (caseNumber !== null) {
      await socket.leave(caseRoom(caseNumber));
      await socket.leave(caseStaffRoom(caseNumber));
    }
    return { ok: true };
  }

  // Only reaches sockets already in the room, i.e. allowed on the case.
  @SubscribeMessage('case:typing')
  announceTyping(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: CaseRoomRequest,
  ): void {
    const user = socketUser(socket);
    const caseNumber = toCaseNumber(body);
    if (!user || caseNumber === null) return;
    const room =
      body?.isInternal === true
        ? caseStaffRoom(caseNumber)
        : caseRoom(caseNumber);
    if (!socket.rooms.has(room)) return;
    socket.to(room).emit(CASE_EVENTS.typing, {
      caseNumber,
      userId: user.userId,
      name: user.name,
    });
  }
}
