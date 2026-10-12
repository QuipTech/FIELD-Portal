import { Injectable, UnauthorizedException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { hashToken } from '../common/security/tokenHasher';
import { AuthTokenService } from './authToken.service';
import { StorageService } from '../storage/storage.service';
import { resolveAvatarUrl } from '../users/resolveAvatarUrl';
import { issueSession } from './authSessionIssuer';
import * as authRepository from './auth.repository';
import { findUserAccess } from './userAccess.repository';
import { AuthResponse } from './types/authResponse';
import { RefreshTokenPayload } from './types/jwtPayload';

const INVALID_SESSION_MESSAGE = 'Session expired or invalid.';

@Injectable()
export class AuthService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly authTokenService: AuthTokenService,
    private readonly storageService: StorageService,
  ) {}

  refresh = async (refreshToken: string): Promise<AuthResponse> => {
    const payload = this.verifyRefreshTokenOrThrow(refreshToken);

    return this.databaseService.withTenant(payload.tenantId, async (client) => {
      const session = await authRepository.findSessionById(client, payload.sub);
      const sessionValid =
        session &&
        session.refresh_token_hash === hashToken(refreshToken) &&
        new Date(session.expires_at) > new Date();

      if (!sessionValid) {
        throw new UnauthorizedException(INVALID_SESSION_MESSAGE);
      }

      const user = await authRepository.findUserById(client, payload.userId);
      if (!user || user.status !== 'active') {
        throw new UnauthorizedException(INVALID_SESSION_MESSAGE);
      }

      const tenant = await authRepository.findTenantById(
        client,
        payload.tenantId,
      );
      return issueSession(
        this.authTokenService,
        this.storageService,
        client,
        tenant,
        user,
        session.id,
      );
    });
  };

  logout = async (refreshToken: string): Promise<void> => {
    const payload = this.verifyRefreshTokenOrThrow(refreshToken);
    await this.databaseService.withTenant(payload.tenantId, (client) =>
      authRepository.expireSession(client, payload.sub),
    );
  };

  me = async (userId: string, tenantId: string) =>
    this.databaseService.withTenant(tenantId, async (client) => {
      const user = await authRepository.findUserById(client, userId);
      if (!user) {
        throw new UnauthorizedException();
      }
      return {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        avatarUrl: await resolveAvatarUrl(this.storageService, user),
        status: user.status,
        // Re-read on each call, so role/permission changes reach the
        // portal without signing in again.
        ...(await findUserAccess(client, user.id)),
      };
    });

  private verifyRefreshTokenOrThrow = (
    refreshToken: string,
  ): RefreshTokenPayload => {
    try {
      return this.authTokenService.verifyRefreshToken(refreshToken);
    } catch {
      throw new UnauthorizedException(INVALID_SESSION_MESSAGE);
    }
  };
}
