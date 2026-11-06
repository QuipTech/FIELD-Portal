import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { StorageService } from '../storage/storage.service';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { runAuditedChange } from '../common/audit/runAuditedChange';
import * as fleetRepository from './machineFleet.repository';
import { toFleetMachineWithPhoto } from './machinePhotoUrl';
import { registerMachine } from './registerMachine';
import { ALL_MACHINES } from '../machineSharing/access/machineScope';
import { RegisterMachineDto } from './dto/registerMachineDto';
import { FleetMachine } from './types/machineFleetResponse';

export const DUPLICATE_SERIAL_MESSAGE =
  'A machine with this serial number is already registered in your organisation.';

// "Add machine": registers a machine against a Machine library model.
// Audited; a serial already registered in
// the organisation is a 409.
@Injectable()
export class MachineRegistrationService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly storageService: StorageService,
  ) {}

  registerMachine = async (
    actor: AuthenticatedUser,
    dto: RegisterMachineDto,
  ): Promise<FleetMachine> =>
    runAuditedChange(
      this.databaseService,
      actor,
      DUPLICATE_SERIAL_MESSAGE,
      async (client) => {
        const machineId = await registerMachine(client, actor, {
          modelId: dto.modelId,
          serialNumber: dto.serialNumber,
          assetNumber: dto.assetNumber ?? null,
          site: dto.site ?? null,
          operatingHours: dto.operatingHours ?? null,
          status: dto.status ?? 'running',
        });
        const row = await fleetRepository.findFleetMachine(
          client,
          actor.tenantId,
          machineId,
          // Their own new machine, even for someone limited to groups.
          ALL_MACHINES,
        );
        const machine = await toFleetMachineWithPhoto(
          this.storageService,
          row!,
        );
        return {
          result: machine,
          audit: {
            action: 'create',
            entityType: 'machine',
            entityId: machineId,
            metadata: {
              name: machine.label,
              serialNumber: dto.serialNumber,
            },
          },
        };
      },
    );
}
