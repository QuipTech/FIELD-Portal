import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  type AuthenticatorTransportFuture,
} from '@simplewebauthn/server';
import { DatabaseService } from '../../database/database.service';
import { AuthenticatedUser } from '../types/authenticatedUser';
import { findUserById, insertAuditLog } from '../auth.repository';
import { getPasskeyRelyingParty } from './passkeyRelyingParty';
import { FinishPasskeyRegistrationDto } from './dto/passkeyDtos';
import * as passkeys from './passkeys.repository';

const UNIQUE_VIOLATION_CODE = '23505';
const DEFAULT_DEVICE_NAME = 'This device';

// Enrolling and managing the signed-in user's own passkeys (Settings).
@Injectable()
export class PasskeyRegistrationService {
  constructor(private readonly database: DatabaseService) {}

  list = (actor: AuthenticatedUser) =>
    this.database.withActor(actor, (client) => passkeys.selectPasskeys(client));

  startRegistration = async (actor: AuthenticatedUser) => {
    const { user, existing } = await this.database.withActor(
      actor,
      async (client) => ({
        user: await findUserById(client, actor.userId),
        existing: await passkeys.selectCredentialIds(client),
      }),
    );
    if (!user) throw new UnauthorizedException();
    const relyingParty = getPasskeyRelyingParty();
    const options = await generateRegistrationOptions({
      rpName: relyingParty.name,
      rpID: relyingParty.id,
      userName: user.email,
      userDisplayName: `${user.first_name} ${user.last_name}`.trim(),
      userID: new Uint8Array(Buffer.from(user.id)),
      attestationType: 'none',
      // The device already enrolled says so instead of making a duplicate.
      excludeCredentials: existing.map((row) => ({
        id: row.credential_id,
        transports: row.transports as AuthenticatorTransportFuture[],
      })),
      // This device's own biometric unlock, saved on it so sign-in needs no email.
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        residentKey: 'required',
        userVerification: 'required',
      },
    });
    const challengeId = await passkeys.issueChallenge(
      this.database,
      'register',
      options.challenge,
      actor.userId,
    );
    return { challengeId, options };
  };

  finishRegistration = async (
    actor: AuthenticatedUser,
    dto: FinishPasskeyRegistrationDto,
  ) => {
    const challenge = await passkeys.takeChallenge(
      this.database,
      dto.challengeId,
      'register',
      actor.userId,
    );
    if (!challenge)
      throw new BadRequestException('That request expired. Please try again.');
    const relyingParty = getPasskeyRelyingParty();
    const verification = await verifyRegistrationResponse({
      response: dto.response,
      expectedChallenge: challenge,
      expectedOrigin: relyingParty.origins,
      expectedRPID: relyingParty.id,
      requireUserVerification: true,
    }).catch(() => null);
    if (!verification?.verified)
      throw new BadRequestException("This device couldn't be verified.");
    const { credential, credentialBackedUp } = verification.registrationInfo;
    const deviceName = dto.deviceName?.trim() || DEFAULT_DEVICE_NAME;
    try {
      return await this.database.withActor(actor, async (client) => {
        const saved = await passkeys.insertPasskey(client, {
          tenantId: actor.tenantId,
          userId: actor.userId,
          credentialId: credential.id,
          publicKey: credential.publicKey,
          signCount: credential.counter,
          transports: credential.transports ?? [],
          deviceName,
          backedUp: credentialBackedUp,
        });
        await insertAuditLog(client, {
          tenantId: actor.tenantId,
          userId: actor.userId,
          action: 'create',
          entityType: 'user_passkey',
          entityId: saved.id,
          metadata: { deviceName },
        });
        return saved;
      });
    } catch (error) {
      if ((error as { code?: string }).code === UNIQUE_VIOLATION_CODE)
        throw new ConflictException('This device is already set up.');
      throw error;
    }
  };

  remove = (actor: AuthenticatedUser, id: string) =>
    this.database.withActor(actor, async (client) => {
      if (!(await passkeys.deletePasskey(client, id)))
        throw new NotFoundException('Passkey not found.');
      await insertAuditLog(client, {
        tenantId: actor.tenantId,
        userId: actor.userId,
        action: 'delete',
        entityType: 'user_passkey',
        entityId: id,
      });
    });
}
