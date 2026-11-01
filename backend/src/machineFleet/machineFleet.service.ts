import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { StorageService } from '../storage/storage.service';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { runAuditedChange } from '../common/audit/runAuditedChange';
import { findUserPermissionCodes } from '../auth/userAccess.repository';
import { MACHINE_LIFECYCLE_PERMISSION } from '../machineLifecycle/lifecycleTransitions';
import { getAccessibleMachineScope } from '../machineGroups/access/getAccessibleMachineScope';
import * as fleetRepository from './machineFleet.repository';
import * as catalogRepository from './machineCatalog.repository';
import {
  groupCatalogByMake,
  toFeaturedDownMachine,
} from './machineFleetMapper';
import { toFleetMachineWithPhoto } from './machinePhotoUrl';
import { ListMachinesQueryDto } from './dto/listMachinesQueryDto';
import { UpdateMachineStatusDto } from './dto/updateMachineStatusDto';
import {
  FleetMachine,
  MachineCatalogMake,
  MachineFleetList,
} from './types/machineFleetResponse';

const MACHINE_NOT_FOUND_MESSAGE = 'Machine not found.';

// The organisation's machines (tenantId from the JWT): the Machines list
// and changing a machine's operating status (a trigger records each
// change, migration 0053). Only machines in the caller's machine scope
// (machineGroups/access) are listed or changed. Registering is
// MachineRegistrationService.
@Injectable()
export class MachineFleetService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly storageService: StorageService,
  ) {}

  listMachines = async (
    actor: AuthenticatedUser,
    filters: ListMachinesQueryDto,
  ): Promise<MachineFleetList> =>
    this.databaseService.withTenant(actor.tenantId, async (client) => {
      const machineScope = await getAccessibleMachineScope(client, actor);
      const scope = {
        tenantId: actor.tenantId,
        viewerId: actor.userId,
        machineScope,
      };
      const rows = await fleetRepository.listMachines(client, scope, filters);
      const total = await fleetRepository.countMachines(client, scope, filters);
      const facets = await catalogRepository.listFleetFacets(
        client,
        actor.tenantId,
        machineScope,
      );
      const featured = await fleetRepository.findFeaturedDownMachine(
        client,
        actor.tenantId,
        machineScope,
      );
      const canManageLifecycle = (
        await findUserPermissionCodes(client, actor.userId)
      ).includes(MACHINE_LIFECYCLE_PERMISSION);
      return {
        items: await Promise.all(
          rows.map((row) =>
            toFleetMachineWithPhoto(
              this.storageService,
              row,
              canManageLifecycle,
            ),
          ),
        ),
        total,
        page: filters.page,
        pageSize: filters.pageSize,
        facets,
        featuredDown: featured
          ? {
              ...toFeaturedDownMachine(featured),
              machine: await toFleetMachineWithPhoto(
                this.storageService,
                featured,
              ),
            }
          : null,
      };
    });

  listCatalog = async (
    actor: AuthenticatedUser,
  ): Promise<MachineCatalogMake[]> =>
    this.databaseService.withTenant(actor.tenantId, async (client) =>
      groupCatalogByMake(
        await catalogRepository.listCatalogModels(client, actor.tenantId),
      ),
    );

  // Audited with the status before and after. Setting the same status
  // again is a no-op for the status history.
  updateStatus = async (
    actor: AuthenticatedUser,
    machineId: string,
    dto: UpdateMachineStatusDto,
  ): Promise<FleetMachine> =>
    runAuditedChange(
      this.databaseService,
      actor,
      MACHINE_NOT_FOUND_MESSAGE,
      async (client) => {
        const scope = await getAccessibleMachineScope(client, actor);
        const previousStatus = await fleetRepository.updateMachineStatus(
          client,
          { tenantId: actor.tenantId, machineId, status: dto.status, scope },
        );
        if (!previousStatus) {
          throw new NotFoundException(MACHINE_NOT_FOUND_MESSAGE);
        }
        const row = await fleetRepository.findFleetMachine(
          client,
          actor.tenantId,
          machineId,
          scope,
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
              before: { status: previousStatus },
              after: { status: dto.status },
            },
          },
        };
      },
    );
}
