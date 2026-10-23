import { Injectable, NotFoundException } from '@nestjs/common';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { runAuditedChange } from '../common/audit/runAuditedChange';
import { DatabaseService } from '../database/database.service';
import { CorrectIdentifiersDto } from './dto/correctIdentifiersDto';
import {
  lockMachineIdentifiers,
  MachineIdentifiers,
  saveMachineIdentifiers,
} from './machineIdentifiers.repository';

const MACHINE_NOT_FOUND_MESSAGE = 'Machine not found.';
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
}

// undefined keeps the current value; null or blank clears it.
const pickIdentifier = (
  requested: string | null | undefined,
  current: string | null,
): string | null => {
  if (requested === undefined) return current;
  return requested || null;
};
