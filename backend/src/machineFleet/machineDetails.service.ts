import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { StorageService } from '../storage/storage.service';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { runAuditedChange } from '../common/audit/runAuditedChange';
import * as fleetRepository from './machineFleet.repository';
import * as detailsRepository from './machineDetails.repository';
import { toFleetMachineWithPhoto } from './machinePhotoUrl';
import { UpdateMachineDto } from './dto/updateMachineDto';
import { FleetMachine } from './types/machineFleetResponse';

const MACHINE_NOT_FOUND_MESSAGE = 'Machine not found.';
const PHOTO_NOT_FOUND_MESSAGE = "That photo isn't in this machine's gallery.";

// Site, hour-meter reading and cover photo; audited with before/after.
@Injectable()
export class MachineDetailsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly storageService: StorageService,
  ) {}

  updateMachine = (
    actor: AuthenticatedUser,
    machineId: string,
    dto: UpdateMachineDto,
  ): Promise<FleetMachine> =>
    runAuditedChange(
      this.databaseService,
      actor,
      MACHINE_NOT_FOUND_MESSAGE,
      async (client) => {
        const scope = { tenantId: actor.tenantId, machineId };
        const before = await detailsRepository.findMachineDetails(
          client,
          actor.tenantId,
          machineId,
        );
        if (!before) throw new NotFoundException(MACHINE_NOT_FOUND_MESSAGE);
        if (
          dto.coverPhotoId &&
          !(await detailsRepository.isMachineGalleryPhoto(client, {
            ...scope,
            photoId: dto.coverPhotoId,
          }))
        ) {
          throw new BadRequestException(PHOTO_NOT_FOUND_MESSAGE);
        }
        await detailsRepository.updateMachineDetails(client, {
          ...scope,
          change: dto,
        });
        const row = await fleetRepository.findFleetMachine(
          client,
          actor.tenantId,
          machineId,
        );
        const machine = await toFleetMachineWithPhoto(
          this.storageService,
          row!,
        );
        return {
          result: machine,
          audit: {
            action: 'update',
            entityType: 'machine',
            entityId: machineId,
            metadata: {
              name: machine.label,
              before: {
                site: before.site,
                operatingHours: before.operating_hours,
                coverPhotoId: before.cover_photo_id,
              },
              after: { ...dto },
            },
          },
        };
      },
    );
}
