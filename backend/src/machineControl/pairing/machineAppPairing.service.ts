import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomBytes, randomInt } from 'crypto';
import * as authRepository from '../../auth/auth.repository';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { hashToken } from '../../common/security/tokenHasher';
import { DatabaseService } from '../../database/database.service';
import { requireMachineAccess } from '../../machineSharing/access/machineAccess';
import { PairDeviceDto } from './machineAppPairing.dtos';
import * as pairingRepository from './machineAppPairing.repository';

const MAX_CODE_ATTEMPTS = 10;
const CODE_REFUSED_MESSAGE = "That code isn't valid or has expired.";
const NOT_CONNECTED_MESSAGE = 'This machine has no machine app connected.';

export interface MachineAppConnection {
  connected: boolean;
  device: {
    id: string;
    serialNumber: string | null;
    platform: string | null;
    appVersion: string | null;
    pairedAt: string;
  } | null;
}

// connected: the machine already has a tablet, so there's no code.
export interface PairingCodeResult {
  connected: boolean;
  code?: string;
  expiresAt?: string;
}

// Leading zeros are valid: 000000 to 999999.
const generateCode = (): string =>
  String(randomInt(1_000_000)).padStart(6, '0');

// Connecting a machine's tablet: a person gets a code for that one machine,
// the tablet sends it back and receives its own token. Own machines and
// 'contribute' shares, like adding history; rows stay in the owning organisation.
@Injectable()
export class MachineAppPairingService {
  constructor(private readonly databaseService: DatabaseService) {}

  getConnection = (
    actor: AuthenticatedUser,
    machineId: string,
  ): Promise<MachineAppConnection> =>
    this.databaseService.withActor(actor, async (client) => {
      await requireMachineAccess(client, machineId, 'read');
      const device = await pairingRepository.findConnectedDevice(
        client,
        machineId,
      );
      return {
        connected: device !== null,
        device: device && {
          id: device.id,
          serialNumber: device.serial_number,
          platform: device.platform,
          appVersion: device.app_version,
          pairedAt: new Date(device.paired_at).toISOString(),
        },
      };
    });

  // A machine already connected gets no code; disconnect it first.
  createPairingCode = (
    actor: AuthenticatedUser,
    machineId: string,
  ): Promise<PairingCodeResult> =>
    this.databaseService.withActor(actor, async (client) => {
      await requireMachineAccess(client, machineId, 'contribute');
      if (await pairingRepository.findConnectedDevice(client, machineId)) {
        return { connected: true };
      }
      for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
        const code = generateCode();
        const expiresAt = await pairingRepository.issuePairingCode(
          client,
          machineId,
          code,
        );
        if (expiresAt) {
          // The code itself stays out of the log.
          await authRepository.insertAuditLog(client, {
            tenantId: actor.tenantId,
            userId: actor.userId,
            action: 'create',
            entityType: 'mc_pairing_code',
            entityId: machineId,
            metadata: { machineId },
          });
          return {
            connected: false,
            code,
            expiresAt: new Date(expiresAt).toISOString(),
          };
        }
      }
      throw new ServiceUnavailableException(
        "Couldn't create a code just now. Please try again.",
      );
    });

  disconnect = (actor: AuthenticatedUser, machineId: string): Promise<void> =>
    this.databaseService.withActor(actor, async (client) => {
      await requireMachineAccess(client, machineId, 'contribute');
      const wasConnected = await pairingRepository.disconnectMachineApp(
        client,
        machineId,
      );
      if (!wasConnected) throw new NotFoundException(NOT_CONNECTED_MESSAGE);
      await authRepository.insertAuditLog(client, {
        tenantId: actor.tenantId,
        userId: actor.userId,
        action: 'delete',
        entityType: 'mc_device',
        entityId: machineId,
        metadata: { machineId },
      });
    });

  // The token is only ever returned here; the database keeps its hash.
  pairDevice = async (dto: PairDeviceDto) => {
    const deviceToken = randomBytes(32).toString('base64url');
    const paired = await this.databaseService.transaction((client) =>
      pairingRepository.pairDevice(client, {
        code: dto.code,
        tokenHash: hashToken(deviceToken),
        serialNumber: dto.serialNumber ?? null,
        platform: dto.platform ?? null,
        appVersion: dto.appVersion ?? null,
      }),
    );
    if (!paired) throw new BadRequestException(CODE_REFUSED_MESSAGE);
    return {
      deviceId: paired.device_id,
      deviceToken,
      machine: { id: paired.machine_id, label: paired.machine_label },
    };
  };
}
