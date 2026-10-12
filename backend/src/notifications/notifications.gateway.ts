import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayInit,
  WebSocketGateway,
} from '@nestjs/websockets';
import { Namespace, Socket } from 'socket.io';
import { verifySocketToken } from '../common/security/verifySocketToken';
import { NotificationListenerService } from './notificationListener.service';
import { userRoom } from './notificationEvents';

const UNAUTHORIZED_MESSAGE = 'unauthorized';

// Live bell at /notifications (Socket.IO). Every signed-in user, in any
// portal, joins only their own room; the server pushes "you have a new
// notification" and the portal refetches over REST.
@WebSocketGateway({ namespace: '/notifications' })
export class NotificationsGateway
  implements OnGatewayInit, OnGatewayConnection
{
  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly listener: NotificationListenerService,
  ) {}

  // The token is checked before the connection is accepted. A refused
  // client gets connect_error "unauthorized".
  afterInit = (namespace: Namespace) => {
    this.listener.attach(namespace);
    namespace.use((socket, next) => {
      verifySocketToken(
        socket,
        this.jwtService,
        this.configService.getOrThrow<string>('JWT_SECRET'),
      )
        .then((payload) => {
          if (!payload) return next(new Error(UNAUTHORIZED_MESSAGE));
          socket.data.userId = payload.sub;
          next();
        })
        .catch((error: unknown) => {
          this.logger.warn(`Notification socket auth failed: ${String(error)}`);
          next(new Error(UNAUTHORIZED_MESSAGE));
        });
    });
  };

  handleConnection = async (socket: Socket) => {
    const userId = socket.data.userId as string | undefined;
    if (userId) await socket.join(userRoom(userId));
  };
}
