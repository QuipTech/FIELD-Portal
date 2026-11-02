import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { StorageService } from '../storage/storage.service';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { runAuditedChange } from '../common/audit/runAuditedChange';
import * as fleetRepository from './machineFleet.repository';
import { toFleetMachineWithPhoto } from './machinePhotoUrl';
import { loadRegistrar, registerMachine } from './registerMachine';
import { RegisterMachineDto } from './dto/registerMachineDto';
import { FleetMachine } from './types/machineFleetResponse';

export const DUPLICATE_SERIAL_MESSAGE =
  'A machine with this serial number is already registered in your organisation.';

// "Add machine": registers a machine against a Machine library model,
// optionally in a customer group. Audited; a serial already registered in
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
        const registrar = await loadRegistrar(client, actor);
        const machineId = await registerMachine(client, registrar, {
          modelId: dto.modelId,
          serialNumber: dto.serialNumber,
          assetNumber: dto.assetNumber ?? null,
          site: dto.site ?? null,
          operatingHours: dto.operatingHours ?? null,
          status: dto.status ?? 'running',
          groupId: dto.groupId ?? null,
        });
        const row = await fleetRepository.findFleetMachine(
          client,
          actor.tenantId,
          machineId,
          registrar.scope,
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
              groupId: machine.groupId,
              groupName: machine.groupName,
            },
          },
        };
      },
    );
}
