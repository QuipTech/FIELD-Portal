import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
import { DatabaseService } from '../database/database.service';
import { findUserPermissionCodes } from '../auth/userAccess.repository';
import { verifySocketToken } from '../common/security/verifySocketToken';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { findUserDisplayName } from './caseOptions.repository';
import { SUPPORT_CREATE_PERMISSION } from './caseAccessPolicy';
import { findIsSupportStaff } from './supportStaffStatus';

export interface CaseSocketUser extends AuthenticatedUser {
  name: string;
  // As of connecting: decides the rooms joined on connect. Joining a case
  // re-reads them (CaseAccessService).
  permissions: string[];
  isStaff: boolean;
}

// The socket twin of JwtAuthGuard + RequirePermissionsGuard: the portal
// sends its access token in the handshake (`auth.token`). Customers need
// support.create; QuipTech support staff may always connect. Null means the
// connection is refused.
@Injectable()
export class CaseSocketAuthenticator {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
  ) {}

  authenticate = async (socket: Socket): Promise<CaseSocketUser | null> => {
    const payload = await verifySocketToken(
      socket,
      this.jwtService,
      this.configService.getOrThrow<string>('JWT_SECRET'),
    );
    if (!payload) return null;

    const { sub: userId, tenantId, email } = payload;
    const isStaff = await findIsSupportStaff(this.databaseService, userId);
    return this.databaseService.withTenant(tenantId, async (client) => {
      const permissions = await findUserPermissionCodes(client, userId);
      const mayConnect =
        permissions.includes(SUPPORT_CREATE_PERMISSION) || isStaff;
      if (!mayConnect) return null;
      const name = await findUserDisplayName(client, tenantId, userId);
      return name === null
        ? null
        : { userId, tenantId, email, name, permissions, isStaff };
    });
  };
}
