import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { getPortalOrigins } from './portalOrigins';

// Socket.IO with the same CORS origins as the REST API. Set here rather
// than on @WebSocketGateway, whose options are read before .env loads.
export class PortalIoAdapter extends IoAdapter {
  createIOServer(port: number, options?: ServerOptions) {
    return super.createIOServer(port, {
      ...options,
      cors: { origin: getPortalOrigins(), credentials: true },
    });
  }
}
