import { randomUUID } from 'crypto';
import { PoolClient } from 'pg';
import { hashToken } from '../common/security/tokenHasher';
import { AuthTokenService } from './authToken.service';
import { StorageService } from '../storage/storage.service';
import { resolveAvatarUrl } from '../users/resolveAvatarUrl';
import * as authRepository from './auth.repository';
import { findUserAccess } from './userAccess.repository';
import { AuthResponse } from './types/authResponse';
import { TenantRow, UserRow } from './types/authRows';

// Creates a new session (register/login) or rotates an existing one
// (refresh), then signs the access/refresh token pair for it. Kept out of
// AuthService so that file stays focused on request-level orchestration.
export const issueSession = async (
  authTokenService: AuthTokenService,
  storageService: StorageService,
  client: PoolClient,
  tenant: TenantRow,
  user: UserRow,
  existingSessionId?: string,
): Promise<AuthResponse> => {
  const sessionId = existingSessionId ?? randomUUID();
  const expiresAt = new Date(
    Date.now() + authTokenService.refreshTokenTtlSeconds * 1000,
  );
  const refreshToken = authTokenService.signRefreshToken({
    sub: sessionId,
    tenantId: tenant.id,
    userId: user.id,
    jti: randomUUID(),
  });
  const refreshTokenHash = hashToken(refreshToken);

  if (existingSessionId) {
    await authRepository.rotateSession(client, {
      sessionId,
      refreshTokenHash,
      expiresAt,
    });
  } else {
    await authRepository.insertSession(client, {
      id: sessionId,
      tenantId: tenant.id,
      userId: user.id,
      refreshTokenHash,
      expiresAt,
    });
  }

  const { roles, permissions } = await findUserAccess(client, user.id);
  const accessToken = authTokenService.signAccessToken({
    sub: user.id,
    tenantId: tenant.id,
    email: user.email,
  });

  return {
    accessToken,
    refreshToken,
    expiresIn: authTokenService.accessTokenTtlSeconds,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      avatarUrl: await resolveAvatarUrl(storageService, user),
      roles,
      permissions,
    },
    tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
  };
};
