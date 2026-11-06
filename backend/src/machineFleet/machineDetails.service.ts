import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { StorageService } from '../storage/storage.service';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import * as authRepository from '../auth/auth.repository';
import { ACCESSIBLE_MACHINES } from '../machineSharing/access/machineScope';
import * as fleetRepository from './machineFleet.repository';
import * as detailsRepository from './machineDetails.repository';
import { toFleetMachineWithPhoto } from './machinePhotoUrl';
import { UpdateMachineDto } from './dto/updateMachineDto';
import { FleetMachine } from './types/machineFleetResponse';

const MACHINE_NOT_FOUND_MESSAGE = 'Machine not found.';
const PHOTO_NOT_FOUND_MESSAGE = "That photo isn't in this machine's gallery.";

// Site, hour-meter reading and cover photo, audited with before/after. Only
// the owning organisation edits a machine: a shared one, or one outside the
// caller's machine scope, is a 404.
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
    this.databaseService.withActor(actor, async (client) => {
      const details = dto;
      const scope = ACCESSIBLE_MACHINES;
      const before = await detailsRepository.findMachineDetails(
        client,
        actor.tenantId,
        machineId,
        scope,
      );
      if (!before) throw new NotFoundException(MACHINE_NOT_FOUND_MESSAGE);
      const row = await fleetRepository.findFleetMachine(
        client,
        actor.tenantId,
        machineId,
        scope,
      );
      if (Object.values(details).some((value) => value !== undefined)) {
        await this.updateDetails(client, actor, machineId, details);
        await authRepository.insertAuditLog(client, {
          tenantId: actor.tenantId,
          userId: actor.userId,
          action: 'update',
          entityType: 'machine',
          entityId: machineId,
          metadata: {
            name: row!.label,
            before: {
              site: before.site,
              operatingHours: before.operating_hours,
              coverPhotoId: before.cover_photo_id,
            },
            after: { ...details },
          },
        });
      }
      return toFleetMachineWithPhoto(
        this.storageService,
        (await fleetRepository.findFleetMachine(
          client,
          actor.tenantId,
          machineId,
          scope,
        ))!,
      );
    });

  private updateDetails = async (
    client: PoolClient,
    actor: AuthenticatedUser,
    machineId: string,
    details: UpdateMachineDto,
  ): Promise<void> => {
    const scope = { tenantId: actor.tenantId, machineId };
    if (
      details.coverPhotoId &&
      !(await detailsRepository.isMachineGalleryPhoto(client, {
        ...scope,
        photoId: details.coverPhotoId,
      }))
    ) {
      throw new BadRequestException(PHOTO_NOT_FOUND_MESSAGE);
    }
    await detailsRepository.updateMachineDetails(client, {
      ...scope,
      change: details,
    });
  };
}
