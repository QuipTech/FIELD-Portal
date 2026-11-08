import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PoolClient } from 'pg';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { AuditEntry, runAuditedChange } from '../common/audit/runAuditedChange';
import { DatabaseService } from '../database/database.service';
import { CorrectIdentifiersDto } from './dto/correctIdentifiersDto';
import { assertMachineAccessible } from '../machineHistory/assertMachineAccessible';
import { auditForMachineOwners } from '../machineSharing/groups/auditForMachineOwners';
import { correctMachineAsPlatformAdmin } from './adminMachineCorrections.repository';
import {
  lockMachineIdentifiers,
  MachineIdentifiers,
  saveMachineIdentifiers,
} from './machineIdentifiers.repository';

const MACHINE_NOT_FOUND_MESSAGE = 'Machine not found.';
const SHARED_FIELDS_MESSAGE =
  "On another organisation's machine only the Plant ID and serial can be corrected here.";
const DUPLICATE_SERIAL_MESSAGE =
  'Another machine in your organisation already has this serial number. Machines are never merged automatically.';

// Plant numbers and VIN/PIN/serials are searchable identifiers, never
// keys: the machine keeps its permanent id, and a correction is an audited
// edit with the old and new values and the reason (spec section 4).
@Injectable()
export class MachineIdentifiersService {
  constructor(private readonly databaseService: DatabaseService) {}

  correctIdentifiers = (
    actor: AuthenticatedUser,
    machineId: string,
    dto: CorrectIdentifiersDto,
  ): Promise<MachineIdentifiers> =>
    runAuditedChange(
      this.databaseService,
      actor,
      DUPLICATE_SERIAL_MESSAGE,
      async (client) => {
        const { access } = await assertMachineAccessible(client, machineId);
        // Another organisation's machine: the platform administrator only.
        if (access.isShared) {
          return this.correctShared(client, actor, machineId, dto);
        }
        const current = await lockMachineIdentifiers(
          client,
          actor.tenantId,
          machineId,
        );
        if (!current) throw new NotFoundException(MACHINE_NOT_FOUND_MESSAGE);
        const next: MachineIdentifiers = {
          serialNumber: dto.serialNumber ?? current.serialNumber,
          fleetNumber: pickIdentifier(dto.fleetNumber, current.fleetNumber),
          assetNumber: pickIdentifier(dto.assetNumber, current.assetNumber),
          registrationNumber: pickIdentifier(
            dto.registrationNumber,
            current.registrationNumber,
          ),
        };
        await saveMachineIdentifiers(client, actor.tenantId, machineId, next);
        return {
          result: next,
          audit: {
            action: 'update',
            entityType: 'machine_identifiers',
            entityId: machineId,
            metadata: { from: current, to: next, reason: dto.reason },
          },
        };
      },
    );

  // The owning organisation gets the audit entry too.
  private correctShared = async (
    client: PoolClient,
    actor: AuthenticatedUser,
    machineId: string,
    dto: CorrectIdentifiersDto,
  ) => {
    if (dto.fleetNumber !== undefined || dto.registrationNumber !== undefined) {
      throw new BadRequestException(SHARED_FIELDS_MESSAGE);
    }
    const correction = await correctMachineAsPlatformAdmin(client, machineId, {
      ...(dto.serialNumber !== undefined && { serialNumber: dto.serialNumber }),
      ...(dto.assetNumber !== undefined && { assetNumber: dto.assetNumber }),
    });
    const toIdentifiers = (fields: typeof correction.after) => ({
      serialNumber: fields.serialNumber,
      fleetNumber: correction.fleetNumber,
      assetNumber: fields.assetNumber,
      registrationNumber: correction.registrationNumber,
    });
    const audit: AuditEntry = {
      action: 'update',
      entityType: 'machine_identifiers',
      entityId: machineId,
      metadata: {
        from: toIdentifiers(correction.before),
        to: toIdentifiers(correction.after),
        reason: dto.reason,
        byPlatformAdmin: true,
      },
    };
    await auditForMachineOwners(client, actor, [correction.tenantId], audit);
    return { result: toIdentifiers(correction.after), audit };
  };
}

// undefined keeps the current value; null or blank clears it.
const pickIdentifier = (
  requested: string | null | undefined,
  current: string | null,
): string | null => {
  if (requested === undefined) return current;
  return requested || null;
};
