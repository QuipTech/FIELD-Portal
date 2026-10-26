import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { AuthenticatedUser } from '../types/authenticatedUser';
import { insertAuditLog } from '../auth.repository';
import { RegisterBiometricKeyDto } from './dto/biometricKeyDtos';
import { ED25519_PUBLIC_KEY_BYTES } from './verifyEd25519Signature';
import * as biometricKeys from './biometricKeys.repository';

const AUDIT_ENTITY_TYPE = 'biometric_key';

// Turning mobile biometric sign-in on and off for the signed-in user's own
// phones, and listing them (portal Settings → Security).
@Injectable()
export class BiometricKeyRegistrationService {
  constructor(private readonly database: DatabaseService) {}

  list = (actor: AuthenticatedUser) =>
    this.database.withActor(actor, (client) =>
      biometricKeys.selectBiometricKeys(client),
    );

  register = async (
    actor: AuthenticatedUser,
    dto: RegisterBiometricKeyDto,
    ip: string | null,
  ) => {
    const publicKey = Buffer.from(dto.publicKey, 'base64');
    if (publicKey.length !== ED25519_PUBLIC_KEY_BYTES)
      throw new BadRequestException('publicKey must be a 32-byte Ed25519 key.');
    return this.database.withActor(actor, async (client) => {
      const saved = await biometricKeys.insertBiometricKey(client, {
        tenantId: actor.tenantId,
        userId: actor.userId,
        algorithm: dto.algorithm,
        publicKey,
        deviceType: dto.deviceType,
        appVersion: dto.appVersion || null,
      });
      await insertAuditLog(client, {
        tenantId: actor.tenantId,
        userId: actor.userId,
        action: 'create',
        entityType: AUDIT_ENTITY_TYPE,
        entityId: saved.id,
        metadata: { deviceType: dto.deviceType, ip },
      });
      return saved;
    });
  };

  // 404 for another user's key too, so ids reveal nothing.
  remove = (actor: AuthenticatedUser, id: string, ip: string | null) =>
    this.database.withActor(actor, async (client) => {
      if (!(await biometricKeys.deleteBiometricKey(client, id)))
        throw new NotFoundException('Device not found.');
      await insertAuditLog(client, {
        tenantId: actor.tenantId,
        userId: actor.userId,
        action: 'delete',
        entityType: AUDIT_ENTITY_TYPE,
        entityId: id,
        metadata: { ip },
      });
    });
}
