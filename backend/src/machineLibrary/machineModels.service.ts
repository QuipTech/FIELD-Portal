import { ConflictException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AdminScope } from '../auth/adminScope/adminScope';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import * as machineModelsRepository from './machineModels.repository';
import { runAuditedChange } from '../common/audit/runAuditedChange';
import {
  assertCanEditModel,
  assertFound,
  MODEL_NOT_FOUND_MESSAGE,
  toMachineModelSummary,
} from './machineLibraryRules';
import { CreateMachineModelDto } from './dto/createMachineModelDto';
import { UpdateMachineModelDto } from './dto/updateMachineModelDto';
import { ListMachineModelsQueryDto } from './dto/listMachineModelsQueryDto';
import { MachineModelSummary } from './types/machineLibraryResponse';

const DUPLICATE_MODEL_MESSAGE =
  'That manufacturer already has a model with this name.';
const MODEL_IN_USE_MESSAGE =
  'Machines still use this model. Move or retire them before deleting it.';

@Injectable()
export class MachineModelsService {
  constructor(private readonly databaseService: DatabaseService) {}

  listModels = async (
    scope: AdminScope,
    query: ListMachineModelsQueryDto,
  ): Promise<MachineModelSummary[]> => {
    const rows = await machineModelsRepository.listModels(
      this.databaseService,
      scope,
      { search: query.search },
    );
    return rows.map((row) => toMachineModelSummary(row, scope));
  };

  // 404 for a model outside the caller's scope (another organisation's).
  getModel = async (
    scope: AdminScope,
    modelId: string,
  ): Promise<MachineModelSummary> => {
    const [row] = await machineModelsRepository.listModels(
      this.databaseService,
      scope,
      { modelId },
    );
    return toMachineModelSummary(
      assertFound(row, MODEL_NOT_FOUND_MESSAGE),
      scope,
    );
  };

  // Visible and changeable by the caller, else 404 / 403.
  getEditableModel = async (
    scope: AdminScope,
    modelId: string,
  ): Promise<MachineModelSummary> => {
    const model = await this.getModel(scope, modelId);
    assertCanEditModel(scope, model.organisation?.id ?? null);
    return model;
  };

  // The Owner's new model joins the shared catalog; an organisation
  // admin's would be their organisation's own.
  createModel = async (
    actor: AuthenticatedUser,
    scope: AdminScope,
    dto: CreateMachineModelDto,
  ): Promise<MachineModelSummary> => {
    const modelId = await runAuditedChange(
      this.databaseService,
      actor,
      DUPLICATE_MODEL_MESSAGE,
      async (client) => {
        const manufacturerId =
          await machineModelsRepository.findOrCreateManufacturer(
            client,
            dto.manufacturerName,
          );
        const id = await machineModelsRepository.createModel(client, {
          tenantId: scope.tenantId,
          manufacturerId,
          name: dto.name,
          category: dto.category,
        });
        const audit = {
          action: 'create',
          entityType: 'machine_model',
        } as const;
        return {
          result: id,
          audit: { ...audit, entityId: id, metadata: { ...dto } },
        };
      },
    );
    return this.getModel(scope, modelId);
  };

  updateModel = async (
    actor: AuthenticatedUser,
    scope: AdminScope,
    modelId: string,
    dto: UpdateMachineModelDto,
  ): Promise<MachineModelSummary> => {
    const before = await this.getEditableModel(scope, modelId);
    await runAuditedChange(
      this.databaseService,
      actor,
      DUPLICATE_MODEL_MESSAGE,
      async (client) => {
        const manufacturerId = dto.manufacturerName
          ? await machineModelsRepository.findOrCreateManufacturer(
              client,
              dto.manufacturerName,
            )
          : undefined;
        const isUpdated = await machineModelsRepository.updateModel(client, {
          modelId,
          manufacturerId,
          name: dto.name,
          category: dto.category,
        });
        // Deleted by someone else between the read above and now.
        if (!isUpdated) assertFound(undefined, MODEL_NOT_FOUND_MESSAGE);
        const metadata = { before, after: dto };
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
    return this.getModel(scope, modelId);
  };

  deleteModel = async (
    actor: AuthenticatedUser,
    scope: AdminScope,
    modelId: string,
  ): Promise<void> => {
    const model = await this.getEditableModel(scope, modelId);
    if (model.assetsCount > 0)
      throw new ConflictException(MODEL_IN_USE_MESSAGE);
    await runAuditedChange(
      this.databaseService,
      actor,
      DUPLICATE_MODEL_MESSAGE,
      async (client) => {
        const isDeleted = await machineModelsRepository.softDeleteModel(
          client,
          modelId,
        );
        if (!isDeleted) assertFound(undefined, MODEL_NOT_FOUND_MESSAGE);
        const metadata = { displayName: model.displayName };
        const audit = {
          action: 'delete',
          entityType: 'machine_model',
        } as const;
        return {
          result: modelId,
          audit: { ...audit, entityId: modelId, metadata },
        };
      },
    );
  };
}
