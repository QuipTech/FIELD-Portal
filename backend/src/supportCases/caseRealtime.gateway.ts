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
import { DatabaseService } from '../database/database.service';
import { findCaseByNumber } from './supportCases.repository';
import {
  CASE_EVENTS,
  CaseEventsPublisher,
  caseRoom,
  tenantRoom,
} from './caseEventsPublisher';
import {
  CaseSocketAuthenticator,
  CaseSocketUser,
} from './caseSocketAuthenticator';

interface CaseRoomRequest {
  caseNumber?: unknown;
}

type RoomAck = { ok: true } | { ok: false; error: string };

const toCaseNumber = (body: CaseRoomRequest | undefined): number | null => {
  const value = Number(body?.caseNumber);
  return Number.isInteger(value) && value > 0 ? value : null;
};

const UNAUTHORIZED_MESSAGE = 'unauthorized';

const socketUser = (socket: Socket) =>
  socket.data.user as CaseSocketUser | undefined;

// Live support-case chat at /support-cases (Socket.IO). On connect every
// portal joins its organisation's room (list updates); `case:join` adds a
// case's room (its messages, changes and typing). Messages themselves are
// sent over REST — this only delivers them.
@WebSocketGateway({ namespace: '/support-cases' })
export class CaseRealtimeGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly logger = new Logger(CaseRealtimeGateway.name);

  constructor(
    private readonly caseSocketAuthenticator: CaseSocketAuthenticator,
    private readonly caseEventsPublisher: CaseEventsPublisher,
    private readonly databaseService: DatabaseService,
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
    if (user) await socket.join(tenantRoom(user.tenantId));
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
      return { ok: false, error: 'Unknown case.' };
    }
    const found = await this.databaseService.withTenant(
      user.tenantId,
      (client) => findCaseByNumber(client, user.tenantId, caseNumber),
    );
    if (!found) return { ok: false, error: 'Unknown case.' };
    await socket.join(caseRoom(user.tenantId, caseNumber));
    return { ok: true };
  }

  @SubscribeMessage('case:leave')
  async leaveCase(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: CaseRoomRequest,
  ): Promise<RoomAck> {
    const user = socketUser(socket);
    const caseNumber = toCaseNumber(body);
    if (user && caseNumber !== null) {
      await socket.leave(caseRoom(user.tenantId, caseNumber));
    }
    return { ok: true };
  }

  // Only reaches sockets already in the case's room, i.e. same tenant.
  @SubscribeMessage('case:typing')
  announceTyping(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: CaseRoomRequest,
  ): void {
    const user = socketUser(socket);
    const caseNumber = toCaseNumber(body);
    if (!user || caseNumber === null) return;
    const room = caseRoom(user.tenantId, caseNumber);
    if (!socket.rooms.has(room)) return;
    socket.to(room).emit(CASE_EVENTS.typing, {
      caseNumber,
      userId: user.userId,
      name: user.name,
    });
  }
}
