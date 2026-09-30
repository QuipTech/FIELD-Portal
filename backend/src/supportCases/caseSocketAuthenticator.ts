import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
import { DatabaseService } from '../database/database.service';
import { findUserPermissionCodes } from '../auth/userAccess.repository';
import { AccessTokenPayload } from '../auth/types/jwtPayload';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { findUserDisplayName } from './caseOptions.repository';

export interface CaseSocketUser extends AuthenticatedUser {
  name: string;
}

const REQUIRED_PERMISSION = 'support.create';

// The socket twin of JwtAuthGuard + RequirePermissionsGuard: the portal
// sends its access token in the handshake (`auth.token`). Null means the
// connection is refused.
@Injectable()
export class CaseSocketAuthenticator {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
  ) {}

  authenticate = async (socket: Socket): Promise<CaseSocketUser | null> => {
    const token: unknown = socket.handshake.auth?.token;
    if (typeof token !== 'string' || !token) return null;
    const payload = await this.jwtService
      .verifyAsync<AccessTokenPayload>(token, {
        secret: this.configService.getOrThrow<string>('JWT_SECRET'),
      })
      .catch(() => null);
    if (!payload) return null;

    const { sub: userId, tenantId, email } = payload;
    return this.databaseService.withTenant(tenantId, async (client) => {
      const permissions = await findUserPermissionCodes(client, userId);
      if (!permissions.includes(REQUIRED_PERMISSION)) return null;
      const name = await findUserDisplayName(client, tenantId, userId);
      return name === null ? null : { userId, tenantId, email, name };
    });
  };
}
