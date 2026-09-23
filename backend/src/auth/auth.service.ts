import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import {
  hashPassword,
  verifyPassword,
} from '../common/security/passwordHasher';
import { hashToken } from '../common/security/tokenHasher';
import { AuthTokenService } from './authToken.service';
import { issueSession } from './authSessionIssuer';
import { registerTenantAndOwner } from './authRegistration';
import * as authRepository from './auth.repository';
import { RegisterDto } from './dto/registerDto';
import { LoginDto } from './dto/loginDto';
import { AuthResponse } from './types/authResponse';
import { RefreshTokenPayload } from './types/jwtPayload';
import { UserRow } from './types/authRows';

const UNIQUE_VIOLATION_CODE = '23505';
const SUSPENDED_TENANT_STATUS = 'suspended';
const INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password.';
const INVALID_SESSION_MESSAGE = 'Session expired or invalid.';

@Injectable()
export class AuthService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly authTokenService: AuthTokenService,
  ) {}

  register = async (dto: RegisterDto): Promise<AuthResponse> => {
    const passwordHash = await hashPassword(dto.password);

    try {
      return await registerTenantAndOwner(
        this.databaseService,
        this.authTokenService,
        dto,
        passwordHash,
      );
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException(
          'An account with those details already exists.',
        );
      }
      throw error;
    }
  };

  login = async (dto: LoginDto): Promise<AuthResponse> => {
    const candidate = await authRepository.findUserByEmailForLogin(
      this.databaseService,
      dto.email,
    );
    if (
      !candidate ||
      candidate.status !== 'active' ||
      candidate.tenant_status === SUSPENDED_TENANT_STATUS
    ) {
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    const passwordMatches = await verifyPassword(
      dto.password,
      candidate.password_hash,
    );
    if (!passwordMatches) {
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    return this.databaseService.withTenant(
      candidate.tenant_id,
      async (client) => {
        await authRepository.updateUserLastLogin(client, candidate.id);
        await authRepository.insertAuditLog(client, {
          tenantId: candidate.tenant_id,
          userId: candidate.id,
          action: 'login',
          entityId: candidate.id,
        });

        const tenant = await authRepository.findTenantById(
          client,
          candidate.tenant_id,
        );
        const user: UserRow = {
          id: candidate.id,
          tenant_id: candidate.tenant_id,
          email: dto.email,
          first_name: candidate.first_name,
          last_name: candidate.last_name,
          status: candidate.status,
        };

        return issueSession(this.authTokenService, client, tenant, user);
      },
    );
  };

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
        status: user.status,
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

  private isUniqueViolation = (error: unknown): boolean =>
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: string }).code === UNIQUE_VIOLATION_CODE;
}
