import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AdminScope } from '../auth/adminScope/adminScope';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import * as modelTreeRepository from './modelTree.repository';
import * as modelTreeChanges from './modelTreeChanges.repository';
import { runAuditedChange } from '../common/audit/runAuditedChange';
import { normalizeImportedSystems } from './machineLibraryRules';
import { MachineModelsService } from './machineModels.service';
import { ModelTreeService } from './modelTree.service';
import { ImportModelTreeDto } from './dto/importModelTreeDto';
import { ModelSystemTree } from './types/machineLibraryResponse';

// Only reachable if two imports race on the same model.
const IMPORT_CONFLICT_MESSAGE =
  'The tree changed while importing. Reload it and try again.';

// "Import tree": bulk-loads systems and their components in one
// transaction, so a failed import leaves the existing tree untouched.
@Injectable()
export class ModelTreeImportService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly machineModelsService: MachineModelsService,
    private readonly modelTreeService: ModelTreeService,
  ) {}

  importTree = async (
    actor: AuthenticatedUser,
    scope: AdminScope,
    modelId: string,
    dto: ImportModelTreeDto,
  ): Promise<ModelSystemTree> => {
    await this.machineModelsService.getEditableModel(scope, modelId);
    const systems = normalizeImportedSystems(dto.systems);

    await runAuditedChange(
      this.databaseService,
      actor,
      IMPORT_CONFLICT_MESSAGE,
      async (client) => {
        if (dto.mode === 'replace') {
          await modelTreeChanges.softDeleteModelTree(client, modelId);
        }
        for (const system of systems) {
          const systemId = await modelTreeRepository.findOrInsertSystem(
            client,
            {
              modelId,
              name: system.name,
            },
          );
          for (const componentName of system.components) {
            await modelTreeRepository.insertComponentIfMissing(client, {
              systemId,
              name: componentName,
            });
          }
        }
        const metadata = {
          import: true,
          mode: dto.mode,
          systemCount: systems.length,
          componentCount: systems.reduce(
            (sum, s) => sum + s.components.length,
            0,
          ),
        };
        const audit = {
          action: 'update',
          entityType: 'machine_model',
        } as const;
        return {
          result: modelId,
          audit: { ...audit, entityId: modelId, metadata },
        };
      },
    );
    return this.modelTreeService.getTree(scope, modelId);
  };
}
