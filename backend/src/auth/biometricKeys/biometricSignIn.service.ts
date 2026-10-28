import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { DatabaseService } from '../../database/database.service';
import { StorageService } from '../../storage/storage.service';
import { AuthTokenService } from '../authToken.service';
import { issueSession } from '../authSessionIssuer';
import * as authRepository from '../auth.repository';
import { CognitoSyncResponse } from '../types/cognitoSyncResponse';
import {
  BiometricChallengeDto,
  BiometricVerifyDto,
} from './dto/biometricKeyDtos';
import {
  buildBiometricSignedMessage,
  verifyEd25519Signature,
} from './verifyEd25519Signature';
import * as biometricKeys from './biometricKeys.repository';
import { BiometricKeyLookupRow } from './biometricKeys.repository';

const CHALLENGE_BYTES = 32;
const NOT_RECOGNISED_MESSAGE =
  "Fingerprint / Face ID sign-in didn't work. Please sign in another way.";
// The app turns biometric sign-in off on this phone when it sees a 404.
const KEY_GONE_MESSAGE =
  'Fingerprint / Face ID sign-in is no longer set up on this phone.';
const ACCOUNT_UNAVAILABLE_MESSAGE =
  'This account is unavailable. Contact your administrator.';
const SUSPENDED_TENANT_STATUS = 'suspended';

const assertAccountActive = (key: BiometricKeyLookupRow) => {
  if (
    key.user_status !== 'active' ||
    key.tenant_status === SUSPENDED_TENANT_STATUS
  )
    throw new ForbiddenException(ACCOUNT_UNAVAILABLE_MESSAGE);
};

// Mobile sign-in with a phone's biometric-locked Ed25519 key: the phone
// signs a fresh 60-second server challenge and FIELD issues the same
// session (and response shape) as POST /auth/sync.
@Injectable()
export class BiometricSignInService {
  constructor(
    private readonly database: DatabaseService,
    private readonly authTokenService: AuthTokenService,
    private readonly storageService: StorageService,
  ) {}

  startSignIn = async ({ keyId }: BiometricChallengeDto) => {
    const key = await biometricKeys.lookupBiometricKey(this.database, keyId);
    if (!key) throw new NotFoundException(KEY_GONE_MESSAGE);
    assertAccountActive(key);
    const challenge = randomBytes(CHALLENGE_BYTES).toString('base64');
    const issued = await biometricKeys.issueChallenge(
      this.database,
      keyId,
      challenge,
    );
    return {
      challengeId: issued.id,
      challenge,
      expiresAt: new Date(issued.expires_at).toISOString(),
    };
  };

  finishSignIn = async (
    dto: BiometricVerifyDto,
    ip: string | null,
  ): Promise<CognitoSyncResponse> => {
    // Taken (deleted) before the signature check, so a replay never passes.
    const challenge = await biometricKeys.takeChallenge(
      this.database,
      dto.challengeId,
      dto.keyId,
    );
    if (!challenge) throw new UnauthorizedException(NOT_RECOGNISED_MESSAGE);
    const key = await biometricKeys.lookupBiometricKey(
      this.database,
      dto.keyId,
    );
    if (!key) throw new NotFoundException(KEY_GONE_MESSAGE);
    const message = buildBiometricSignedMessage(dto.challengeId, challenge);
    if (!verifyEd25519Signature(key.public_key, message, dto.signature)) {
      await biometricKeys.recordFailedSignIn(this.database, key.id, ip);
      throw new UnauthorizedException(NOT_RECOGNISED_MESSAGE);
    }
    assertAccountActive(key);
    return { status: 'signedIn', session: await this.openSession(key, ip) };
  };

  private openSession = (key: BiometricKeyLookupRow, ip: string | null) => {
    const actor = { tenantId: key.tenant_id, userId: key.user_id };
    return this.database.withActor(actor, async (client) => {
      await biometricKeys.recordBiometricKeyUse(client, key.id);
      await authRepository.updateUserLastLogin(client, actor.userId);
      await authRepository.insertAuditLog(client, {
        ...actor,
        action: 'login',
        entityId: actor.userId,
        metadata: {
          method: 'biometric',
          biometricKeyId: key.id,
          deviceType: key.device_type,
          ip,
        },
      });
      const user = await authRepository.findUserById(client, actor.userId);
      if (!user) throw new UnauthorizedException(NOT_RECOGNISED_MESSAGE);
      const tenant = await authRepository.findTenantById(
        client,
        actor.tenantId,
      );
      return issueSession(
        this.authTokenService,
        this.storageService,
        client,
        tenant,
        user,
      );
    });
  };
}
