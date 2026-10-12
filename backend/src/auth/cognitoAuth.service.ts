import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { UsersService } from '../users/users.service';
import { AuthTokenService } from './authToken.service';
import { StorageService } from '../storage/storage.service';
import { issueSession } from './authSessionIssuer';
import * as authRepository from './auth.repository';
import { AuthResponse } from './types/authResponse';
import { CognitoIdentity } from './types/cognitoIdentity';
import { CognitoSyncResponse } from './types/cognitoSyncResponse';
import { UserRow } from './types/authRows';
import { SyncCognitoDto } from './dto/syncCognitoDto';
import { CognitoSignupProfile } from '../users/types/cognitoUserResolution';

// A signup profile only counts once both fields are present — anything
// less means the signup dialog still has to be shown.
const toSignupProfile = (
  dto: SyncCognitoDto,
): CognitoSignupProfile | undefined =>
  dto.companyName && dto.phoneNumber
    ? { companyName: dto.companyName, phoneNumber: dto.phoneNumber }
    : undefined;

// Exchanges a verified Cognito identity (email/password, Google or Apple)
// for a regular FIELD session, so every JwtAuthGuard route just works.
@Injectable()
export class CognitoAuthService {
  private readonly logger = new Logger(CognitoAuthService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly authTokenService: AuthTokenService,
    private readonly usersService: UsersService,
    private readonly storageService: StorageService,
  ) {}

  syncAndIssueSession = async (
    identity: CognitoIdentity,
    dto: SyncCognitoDto,
  ): Promise<CognitoSyncResponse> => {
    const resolution = await this.usersService.findOrCreateFromCognito(
      identity,
      toSignupProfile(dto),
    );
    if (resolution.status === 'profileRequired') {
      this.logger.log(`No FIELD account yet for ${identity.email}`);
      return { status: 'profileRequired' };
    }

    this.logger.log(
      `Signed in user ${resolution.user.id} (${identity.authProvider}), ` +
        `avatar_url=${resolution.user.avatar_url ?? 'null'}`,
    );
    const session = await this.issueSessionForUser(resolution.user);
    return { status: 'signedIn', session };
  };

  private issueSessionForUser = (user: UserRow): Promise<AuthResponse> =>
    this.databaseService.withTenant(user.tenant_id, async (client) => {
      await authRepository.insertAuditLog(client, {
        tenantId: user.tenant_id,
        userId: user.id,
        action: 'login',
        entityId: user.id,
      });
      const tenant = await authRepository.findTenantById(
        client,
        user.tenant_id,
      );
      return issueSession(
        this.authTokenService,
        this.storageService,
        client,
        tenant,
        user,
      );
    });
}
