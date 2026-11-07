import { Injectable, NotFoundException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { StorageService } from '../storage/storage.service';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { runAuditedChange } from '../common/audit/runAuditedChange';
import { findUserPermissionCodes } from '../auth/userAccess.repository';
import {
  hasFullMachineAccess,
  MACHINE_LIFECYCLE_PERMISSION,
  toLifecycleState,
} from '../machineLifecycle/lifecycleTransitions';
import { readFeatureKeys } from '../entitlements/entitlements.service';
import { FEATURE_KEYS } from '../entitlements/featureKeys';
import { ACCESSIBLE_MACHINES } from '../machineSharing/access/machineScope';
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
import { FleetMachineRow } from './types/machineFleetRows';

const MACHINE_NOT_FOUND_MESSAGE = 'Machine not found.';
// Most photos a list row slides through; the gallery shows the rest.
const MAX_ROW_PHOTOS = 10;

// The caller's machines: the Machines list (their organisation's plus
// shared ones) and changing a machine's operating status (own organisation
// only; a trigger records each change, migration 0053). Only machines in
// the caller's machine scope (machineSharing/access) are listed or changed. Registering is
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
    this.databaseService.withActor(actor, async (client) => {
      const machineScope = ACCESSIBLE_MACHINES;
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
      const rowPhotoKeys = await this.readRowPhotoKeys(client, rows);
      return {
        items: await Promise.all(
          rows.map(async (row) => ({
            ...(await toFleetMachineWithPhoto(
              this.storageService,
              row,
              canManageLifecycle,
            )),
            photoUrls: await Promise.all(
              (rowPhotoKeys.get(row.id) ?? []).map(
                async (key) =>
                  (await this.storageService.getSignedDownloadUrl(key)).url,
              ),
            ),
          })),
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
        const scope = ACCESSIBLE_MACHINES;
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

  // Only for machines whose gallery the caller may open, the same rule as
  // RequireActiveMachineGuard: active, and on the owner's current plan unless
  // it's shared (the owner pays for those). Others keep their single photoUrl.
  private readRowPhotoKeys = async (
    client: PoolClient,
    rows: FleetMachineRow[],
  ): Promise<Map<string, string[]>> => {
    const active = rows.filter((row) =>
      hasFullMachineAccess(toLifecycleState(row.lifecycle_state)),
    );
    const hasPlan =
      active.some((row) => !row.is_shared) &&
      (await readFeatureKeys(client)).has(FEATURE_KEYS.assetHistory);
    const machineIds = active
      .filter((row) => row.is_shared || hasPlan)
      .map((row) => row.id);
    const keys = new Map<string, string[]>();
    if (machineIds.length === 0) return keys;
    const found = await fleetRepository.listRowPhotoKeys(
      client,
      machineIds,
      MAX_ROW_PHOTOS,
    );
    for (const { machine_id: machineId, storage_key: key } of found) {
      keys.set(machineId, [...(keys.get(machineId) ?? []), key]);
    }
    return keys;
  };
}
