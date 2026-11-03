import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../../database/database.service';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import * as authRepository from '../../auth/auth.repository';
import * as catalogRepository from '../machineCatalog.repository';
import { DUPLICATE_SERIAL_MESSAGE } from '../machineRegistration.service';
import { ImportFleetDto } from './dto/importFleetDto';
import {
  FleetImportPlan,
  FleetImportRowResult,
  planFleetImport,
} from './fleetImportPlan';

export const IMPORT_HAS_ERRORS_CODE = 'import_has_errors';
const UNIQUE_VIOLATION_CODE = '23505';

export interface FleetImportResult {
  dryRun: boolean;
  // Machines saved (0 for a dry run).
  imported: number;
  rows: FleetImportRowResult[];
}

// Fleet CSV import (the portal parses the file and maps its columns).
// Every row is checked first; with any error nothing is saved and the
// rows come back with their errors (400 import_has_errors). Otherwise all
// machines are saved in one transaction, each audited like a single
// registration.
@Injectable()
export class FleetImportService {
  constructor(private readonly databaseService: DatabaseService) {}

  importFleet = async (
    actor: AuthenticatedUser,
    dto: ImportFleetDto,
  ): Promise<FleetImportResult> => {
    try {
      return await this.databaseService.withActor(actor, async (client) => {
        const plan = await planFleetImport(client, actor.tenantId, dto.rows);
        const summary = { rows: plan.rows };
        if (dto.dryRun) return { dryRun: true, imported: 0, ...summary };
        const errorCount = plan.rows.filter((row) => row.errors.length).length;
        if (errorCount) {
          throw new BadRequestException({
            statusCode: 400,
            code: IMPORT_HAS_ERRORS_CODE,
            message: `${errorCount} of ${plan.rows.length} rows can't be imported. Nothing was saved.`,
            rows: plan.rows,
          });
        }
        await this.save(client, actor, plan);
        return { dryRun: false, imported: plan.machines.length, ...summary };
      });
    } catch (error) {
      // Only when someone registers the same serial mid-import.
      if ((error as { code?: string }).code === UNIQUE_VIOLATION_CODE) {
        throw new ConflictException(DUPLICATE_SERIAL_MESSAGE);
      }
      throw error;
    }
  };

  private save = async (
    client: PoolClient,
    actor: AuthenticatedUser,
    plan: FleetImportPlan,
  ): Promise<void> => {
    for (const machine of plan.machines) {
      const machineId = await catalogRepository.insertMachine(client, {
        tenantId: actor.tenantId,
        createdBy: actor.userId,
        manufacturerId: machine.manufacturerId,
        modelId: machine.modelId,
        serialNumber: machine.serialNumber,
        assetNumber: machine.plantId,
        site: machine.site,
        operatingHours: machine.operatingHours,
        status: machine.status,
      });
      await authRepository.insertAuditLog(client, {
        tenantId: actor.tenantId,
        userId: actor.userId,
        action: 'create',
        entityType: 'machine',
        entityId: machineId,
        metadata: {
          name: machine.plantId ?? machine.serialNumber,
          serialNumber: machine.serialNumber,
          imported: true,
        },
      });
    }
  };
}
