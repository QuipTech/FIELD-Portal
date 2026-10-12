import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { AdminScope } from '../auth/adminScope/adminScope';
import * as machineModelsRepository from './machineModels.repository';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import * as modelTreeRepository from './modelTree.repository';
import * as modelTreeChanges from './modelTreeChanges.repository';
import { AuditEntry, runAuditedChange } from '../common/audit/runAuditedChange';
import { MachineModelsService } from './machineModels.service';
import {
  assertCanEditModel,
  assertFound,
  buildSystemTree,
  COMPONENT_NOT_FOUND_MESSAGE,
  SYSTEM_NOT_FOUND_MESSAGE,
} from './machineLibraryRules';
import { ModelSystemTree } from './types/machineLibraryResponse';

const DUPLICATE_SYSTEM_MESSAGE =
  'This model already has a system with that name.';
const DUPLICATE_COMPONENT_MESSAGE =
  'This system already has a component with that name.';

type TreeEntity = 'model_system' | 'model_component';

// Every change resolves to the model's refreshed tree, so the page can
// re-render it straight from the response.
@Injectable()
export class ModelTreeService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly machineModelsService: MachineModelsService,
  ) {}

  getTree = async (
    scope: AdminScope,
    modelId: string,
  ): Promise<ModelSystemTree> => {
    await this.machineModelsService.getModel(scope, modelId);
    const rows = await modelTreeRepository.listTreeRows(
      this.databaseService,
      modelId,
    );
    return buildSystemTree(modelId, rows);
  };

  addSystem = async (
    actor: AuthenticatedUser,
    scope: AdminScope,
    modelId: string,
    name: string,
  ): Promise<ModelSystemTree> => {
    await this.machineModelsService.getEditableModel(scope, modelId);
    await runAuditedChange(
      this.databaseService,
      actor,
      DUPLICATE_SYSTEM_MESSAGE,
      async (client) => {
        const systemId = await modelTreeRepository.insertSystem(client, {
          modelId,
          name,
        });
        const audit = this.auditEntry('create', 'model_system', systemId, {
          modelId,
          name,
        });
        return { result: modelId, audit };
      },
    );
    return this.getTree(scope, modelId);
  };

  addComponent = (
    actor: AuthenticatedUser,
    scope: AdminScope,
    systemId: string,
    name: string,
  ) =>
    this.changeTreeNode(actor, scope, {
      entityType: 'model_component',
      action: 'create',
      notFoundMessage: SYSTEM_NOT_FOUND_MESSAGE,
      metadata: { systemId, name },
      apply: async (client) => {
        const inserted = await modelTreeRepository.insertComponent(client, {
          systemId,
          name,
        });
        return {
          modelId: inserted?.modelId,
          entityId: inserted?.id ?? systemId,
        };
      },
    });

  renameSystem = (
    actor: AuthenticatedUser,
    scope: AdminScope,
    systemId: string,
    name: string,
  ) =>
    this.changeTreeNode(actor, scope, {
      entityType: 'model_system',
      action: 'update',
      notFoundMessage: SYSTEM_NOT_FOUND_MESSAGE,
      metadata: { name },
      apply: async (client) => ({
        modelId: await modelTreeChanges.renameSystem(client, {
          systemId,
          name,
        }),
        entityId: systemId,
      }),
    });

  deleteSystem = (
    actor: AuthenticatedUser,
    scope: AdminScope,
    systemId: string,
  ) =>
    this.changeTreeNode(actor, scope, {
      entityType: 'model_system',
      action: 'delete',
      notFoundMessage: SYSTEM_NOT_FOUND_MESSAGE,
      metadata: {},
      apply: async (client) => ({
        modelId: await modelTreeChanges.softDeleteSystem(client, systemId),
        entityId: systemId,
      }),
    });

  renameComponent = (
    actor: AuthenticatedUser,
    scope: AdminScope,
    componentId: string,
    name: string,
  ) =>
    this.changeTreeNode(actor, scope, {
      entityType: 'model_component',
      action: 'update',
      notFoundMessage: COMPONENT_NOT_FOUND_MESSAGE,
      metadata: { name },
      apply: async (client) => ({
        modelId: await modelTreeChanges.renameComponent(client, {
          componentId,
          name,
        }),
        entityId: componentId,
      }),
    });

  deleteComponent = (
    actor: AuthenticatedUser,
    scope: AdminScope,
    componentId: string,
  ) =>
    this.changeTreeNode(actor, scope, {
      entityType: 'model_component',
      action: 'delete',
      notFoundMessage: COMPONENT_NOT_FOUND_MESSAGE,
      metadata: {},
      apply: async (client) => ({
        modelId: await modelTreeChanges.softDeleteComponent(
          client,
          componentId,
        ),
        entityId: componentId,
      }),
    });

  // Applies one system/component change and audits it; `apply` resolves
  // to the owning model's id, or undefined when the node isn't live. The
  // caller's right to edit that model is checked in the same transaction,
  // so a refused change is rolled back.
  private changeTreeNode = async (
    actor: AuthenticatedUser,
    scope: AdminScope,
    change: {
      entityType: TreeEntity;
      action: AuditEntry['action'];
      notFoundMessage: string;
      metadata: Record<string, unknown>;
      apply: (
        client: PoolClient,
      ) => Promise<{ modelId?: string; entityId: string }>;
    },
  ): Promise<ModelSystemTree> => {
    const duplicateMessage =
      change.entityType === 'model_system'
        ? DUPLICATE_SYSTEM_MESSAGE
        : DUPLICATE_COMPONENT_MESSAGE;
    const modelId = await runAuditedChange(
      this.databaseService,
      actor,
      duplicateMessage,
      async (client) => {
        const outcome = await change.apply(client);
        const foundModelId = assertFound(
          outcome.modelId,
          change.notFoundMessage,
        );
        const modelTenantId = await machineModelsRepository.findModelTenantId(
          client,
          foundModelId,
        );
        if (
          modelTenantId !== undefined &&
          !scope.isPlatform &&
          modelTenantId !== scope.tenantId
        ) {
          // Another organisation's model: behave as if it doesn't exist.
          assertFound(undefined, change.notFoundMessage);
        }
        assertCanEditModel(scope, modelTenantId ?? null);
        const metadata = { ...change.metadata, modelId: foundModelId };
        const audit = this.auditEntry(
          change.action,
          change.entityType,
          outcome.entityId,
          metadata,
        );
        return { result: foundModelId, audit };
      },
    );
    return this.getTree(scope, modelId);
  };

  private auditEntry = (
    action: AuditEntry['action'],
    entityType: TreeEntity,
    entityId: string,
    metadata: Record<string, unknown>,
  ): AuditEntry => ({ action, entityType, entityId, metadata });
}
