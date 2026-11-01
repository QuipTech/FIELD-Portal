import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { StorageService } from '../storage/storage.service';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import * as authRepository from '../auth/auth.repository';
import { findUserPermissionCodes } from '../auth/userAccess.repository';
import { getAccessibleMachineScope } from '../machineGroups/access/getAccessibleMachineScope';
import { ORGANISATION_ADMIN_PERMISSION } from '../machineGroups/access/machineScope';
import { ADMIN_ONLY_GROUPING_MESSAGE } from '../machineGroups/access/newMachineGroupRule';
import { moveMachinesToGroup } from '../machineGroups/moveMachinesToGroup';
import * as fleetRepository from './machineFleet.repository';
import * as detailsRepository from './machineDetails.repository';
import { toFleetMachineWithPhoto } from './machinePhotoUrl';
import { UpdateMachineDto } from './dto/updateMachineDto';
import { FleetMachine } from './types/machineFleetResponse';

const MACHINE_NOT_FOUND_MESSAGE = 'Machine not found.';
const PHOTO_NOT_FOUND_MESSAGE = "That photo isn't in this machine's gallery.";

type DetailsChange = Omit<UpdateMachineDto, 'groupId'>;

// Site, hour-meter reading and cover photo, audited with before/after; and
// the machine's customer group (organisation admins only), audited as a
// move between groups. Both in one transaction. A machine outside the
// caller's machine scope is a 404.
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
      const { groupId, ...details } = dto;
      const scope = await getAccessibleMachineScope(client, actor);
      const before = await detailsRepository.findMachineDetails(
        client,
        actor.tenantId,
        machineId,
        scope,
      );
      if (!before) throw new NotFoundException(MACHINE_NOT_FOUND_MESSAGE);
      if (groupId !== undefined) {
        const permissions = await findUserPermissionCodes(client, actor.userId);
        if (!permissions.includes(ORGANISATION_ADMIN_PERMISSION)) {
          throw new ForbiddenException(ADMIN_ONLY_GROUPING_MESSAGE);
        }
        await moveMachinesToGroup(client, actor, {
          machineIds: [machineId],
          groupId,
        });
      }
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
    details: DetailsChange,
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
