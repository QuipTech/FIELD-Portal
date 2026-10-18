import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type AuthenticatorTransportFuture,
} from '@simplewebauthn/server';
import { DatabaseService } from '../../database/database.service';
import { StorageService } from '../../storage/storage.service';
import { AuthTokenService } from '../authToken.service';
import { issueSession } from '../authSessionIssuer';
import * as authRepository from '../auth.repository';
import { AuthResponse } from '../types/authResponse';
import { getPasskeyRelyingParty } from './passkeyRelyingParty';
import { FinishPasskeySignInDto } from './dto/passkeyDtos';
import * as passkeys from './passkeys.repository';

const NOT_RECOGNISED_MESSAGE =
  "Face ID / Touch ID sign-in didn't work. Sign in with your password instead.";
const ACCOUNT_UNAVAILABLE_MESSAGE =
  'This account is unavailable. Contact your administrator.';
const SUSPENDED_TENANT_STATUS = 'suspended';

// Signing in with a passkey: no email or password. The device picks the
// account, proves it holds that account's private key by signing a fresh
// server challenge, and FIELD issues the same session any sign-in gets.
@Injectable()
export class PasskeySignInService {
  constructor(
    private readonly database: DatabaseService,
    private readonly authTokenService: AuthTokenService,
    private readonly storageService: StorageService,
  ) {}

  startSignIn = async () => {
    const options = await generateAuthenticationOptions({
      rpID: getPasskeyRelyingParty().id,
      userVerification: 'required',
    });
    const challengeId = await passkeys.issueChallenge(
      this.database,
      'login',
      options.challenge,
      null,
    );
    return { challengeId, options };
  };

  finishSignIn = async (dto: FinishPasskeySignInDto): Promise<AuthResponse> => {
    const challenge = await passkeys.takeChallenge(
      this.database,
      dto.challengeId,
      'login',
      null,
    );
    const passkey =
      challenge && typeof dto.response.id === 'string'
        ? await passkeys.lookupPasskey(this.database, dto.response.id)
        : null;
    if (!challenge || !passkey)
      throw new UnauthorizedException(NOT_RECOGNISED_MESSAGE);
    const relyingParty = getPasskeyRelyingParty();
    // Also rejects a signature counter that went backwards (a cloned key).
    const verification = await verifyAuthenticationResponse({
      response: dto.response,
      expectedChallenge: challenge,
      expectedOrigin: relyingParty.origins,
      expectedRPID: relyingParty.id,
      requireUserVerification: true,
      credential: {
        id: dto.response.id,
        publicKey: new Uint8Array(passkey.public_key),
        counter: Number(passkey.sign_count),
        transports: passkey.transports as AuthenticatorTransportFuture[],
      },
    }).catch(() => null);
    if (!verification?.verified)
      throw new UnauthorizedException(NOT_RECOGNISED_MESSAGE);
    // Checked only after the signature, so the account's state is never
    // revealed to someone who doesn't hold its key.
    if (
      passkey.user_status !== 'active' ||
      passkey.tenant_status === SUSPENDED_TENANT_STATUS
    )
      throw new ForbiddenException(ACCOUNT_UNAVAILABLE_MESSAGE);

    const actor = { tenantId: passkey.tenant_id, userId: passkey.user_id };
    return this.database.withActor(actor, async (client) => {
      await passkeys.recordPasskeyUse(
        client,
        passkey.id,
        verification.authenticationInfo.newCounter,
      );
      await authRepository.updateUserLastLogin(client, actor.userId);
      await authRepository.insertAuditLog(client, {
        ...actor,
        action: 'login',
        entityId: actor.userId,
        metadata: { method: 'passkey', passkeyId: passkey.id },
      });
      const user = await authRepository.findUserById(client, actor.userId);
      if (!user) throw new UnauthorizedException(NOT_RECOGNISED_MESSAGE);
      const tenant = await authRepository.findTenantById(client, actor.tenantId);
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
