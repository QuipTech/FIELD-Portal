import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
import { AccessTokenPayload } from '../../auth/types/jwtPayload';

// The socket twin of JwtAuthGuard: the portal sends its access token in
// the Socket.IO handshake (`auth.token`). Null when it's missing, invalid
// or expired.
export const verifySocketToken = async (
  socket: Socket,
  jwtService: JwtService,
  secret: string,
): Promise<AccessTokenPayload | null> => {
  const token: unknown = socket.handshake.auth?.token;
  if (typeof token !== 'string' || !token) return null;
  return jwtService
    .verifyAsync<AccessTokenPayload>(token, { secret })
    .catch(() => null);
};
