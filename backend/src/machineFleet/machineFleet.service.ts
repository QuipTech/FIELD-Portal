import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { runAuditedChange } from '../common/audit/runAuditedChange';
import * as fleetRepository from './machineFleet.repository';
import * as catalogRepository from './machineCatalog.repository';
import {
  groupCatalogByMake,
  toFeaturedDownMachine,
  toFleetMachine,
} from './machineFleetMapper';
import { ListMachinesQueryDto } from './dto/listMachinesQueryDto';
import { RegisterMachineDto } from './dto/registerMachineDto';
import { UpdateMachineStatusDto } from './dto/updateMachineStatusDto';
import {
  FleetMachine,
  MachineCatalogMake,
  MachineFleetList,
} from './types/machineFleetResponse';

const DUPLICATE_SERIAL_MESSAGE =
  'A machine with this serial number is already registered in your organisation.';
const MACHINE_NOT_FOUND_MESSAGE = 'Machine not found.';
const UNKNOWN_MODEL_MESSAGE =
  'That model is not in the Machine library. Pick another, or ask your QuipTech admin to add it.';

// The organisation's machines (tenantId from the JWT): the Machines list,
// registering a new machine against a Machine library model, and changing
// its operating status (a trigger records each change, migration 0053).
@Injectable()
export class MachineFleetService {
  constructor(private readonly databaseService: DatabaseService) {}

  listMachines = async (
    actor: AuthenticatedUser,
    filters: ListMachinesQueryDto,
  ): Promise<MachineFleetList> =>
    this.databaseService.withTenant(actor.tenantId, async (client) => {
      const rows = await fleetRepository.listMachines(
        client,
        actor.tenantId,
        filters,
      );
      const total = await fleetRepository.countMachines(
        client,
        actor.tenantId,
        filters,
      );
      const facets = await catalogRepository.listFleetFacets(
        client,
        actor.tenantId,
      );
      const featured = await fleetRepository.findFeaturedDownMachine(
        client,
        actor.tenantId,
      );
      return {
        items: rows.map(toFleetMachine),
        total,
        facets,
        featuredDown: featured ? toFeaturedDownMachine(featured) : null,
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

  // Audited; a serial already registered in the organisation is a 409.
  registerMachine = async (
    actor: AuthenticatedUser,
    dto: RegisterMachineDto,
  ): Promise<FleetMachine> =>
    runAuditedChange(
      this.databaseService,
      actor,
      DUPLICATE_SERIAL_MESSAGE,
      async (client) => {
        const manufacturerId = await catalogRepository.findModelManufacturerId(
          client,
          { modelId: dto.modelId, tenantId: actor.tenantId },
        );
        if (!manufacturerId) {
          throw new BadRequestException(UNKNOWN_MODEL_MESSAGE);
        }
        const machineId = await catalogRepository.insertMachine(client, {
          tenantId: actor.tenantId,
          createdBy: actor.userId,
          manufacturerId,
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
        );
        const machine = toFleetMachine(row!);
        return {
          result: machine,
          audit: {
            action: 'create',
            entityType: 'machine',
            entityId: machineId,
            metadata: { name: machine.label, serialNumber: dto.serialNumber },
          },
        };
      },
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
        const previousStatus = await fleetRepository.updateMachineStatus(
          client,
          { tenantId: actor.tenantId, machineId, status: dto.status },
        );
        if (!previousStatus) {
          throw new NotFoundException(MACHINE_NOT_FOUND_MESSAGE);
        }
        const row = await fleetRepository.findFleetMachine(
          client,
          actor.tenantId,
          machineId,
        );
        const machine = toFleetMachine(row!);
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
