import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { runAuditedChange } from '../common/audit/runAuditedChange';
import * as groupsRepository from './machineGroups.repository';
import * as movesRepository from './machineGroupMoves.repository';
import { toMachineGroup, toMachineGroupDetail } from './machineGroupsMapper';
import { GROUP_NOT_FOUND_MESSAGE } from './moveMachinesToGroup';
import {
  CreateMachineGroupDto,
  UpdateMachineGroupDto,
} from './dto/machineGroupDtos';
import {
  MachineGroup,
  MachineGroupDetail,
  MachineGroupRow,
} from './types/machineGroupTypes';

const DUPLICATE_NAME_MESSAGE =
  'A machine group with this name already exists in your organisation.';
export const GROUP_HAS_MACHINES_CODE = 'group_has_machines';

// An organisation admin's machine groups (the routes check
// admin.manage_users): list with counts, one group with its people,
// create, rename/edit and delete. Every change is audited.
@Injectable()
export class MachineGroupsService {
  constructor(private readonly databaseService: DatabaseService) {}

  listGroups = (actor: AuthenticatedUser): Promise<MachineGroup[]> =>
    this.databaseService.withTenant(actor.tenantId, async (client) =>
      (await groupsRepository.listGroups(client, actor.tenantId)).map(
        toMachineGroup,
      ),
    );

  getGroup = (
    actor: AuthenticatedUser,
    groupId: string,
  ): Promise<MachineGroupDetail> =>
    this.databaseService.withTenant(actor.tenantId, async (client) => {
      const row = await this.requireGroup(client, actor, groupId);
      const users = await groupsRepository.listGroupUsers(
        client,
        actor.tenantId,
        groupId,
      );
      return toMachineGroupDetail(row, users);
    });

  // A live name already used (ignoring case) is a 409.
  createGroup = (
    actor: AuthenticatedUser,
    dto: CreateMachineGroupDto,
  ): Promise<MachineGroup> =>
    runAuditedChange(
      this.databaseService,
      actor,
      DUPLICATE_NAME_MESSAGE,
      async (client) => {
        const groupId = await groupsRepository.insertGroup(
          client,
          actor.tenantId,
          dto,
        );
        const group = toMachineGroup(
          await this.requireGroup(client, actor, groupId),
        );
        return {
          result: group,
          audit: {
            action: 'create',
            entityType: 'machine_group',
            entityId: groupId,
            metadata: { name: group.name },
          },
        };
      },
    );

  // Audited with the fields before and after; a rename says so.
  updateGroup = (
    actor: AuthenticatedUser,
    groupId: string,
    dto: UpdateMachineGroupDto,
  ): Promise<MachineGroup> =>
    runAuditedChange(
      this.databaseService,
      actor,
      DUPLICATE_NAME_MESSAGE,
      async (client) => {
        const before = toMachineGroup(
          await this.requireGroup(client, actor, groupId),
        );
        await groupsRepository.updateGroup(client, {
          tenantId: actor.tenantId,
          groupId,
          fields: dto,
        });
        const after = toMachineGroup(
          await this.requireGroup(client, actor, groupId),
        );
        const changed = (
          Object.keys(dto) as (keyof UpdateMachineGroupDto)[]
        ).filter((key) => dto[key] !== undefined);
        return {
          result: after,
          audit: {
            action: 'update',
            entityType: 'machine_group',
            entityId: groupId,
            metadata: {
              name: after.name,
              renamed: before.name !== after.name,
              before: Object.fromEntries(
                changed.map((key) => [key, before[key]]),
              ),
              after: Object.fromEntries(
                changed.map((key) => [key, after[key]]),
              ),
            },
          },
        };
      },
    );

  // Soft delete. Its machines become ungrouped and everyone's access to
  // it goes. A group that still has machines needs force (else 409 with
  // the machine count, for the confirmation dialog).
  deleteGroup = (
    actor: AuthenticatedUser,
    groupId: string,
    force: boolean,
  ): Promise<void> =>
    runAuditedChange(
      this.databaseService,
      actor,
      DUPLICATE_NAME_MESSAGE,
      async (client) => {
        const group = await this.requireGroup(client, actor, groupId);
        if (group.machine_count > 0 && !force) {
          throw new ConflictException({
            statusCode: 409,
            code: GROUP_HAS_MACHINES_CODE,
            machineCount: group.machine_count,
            userCount: group.user_count,
            message: `Its ${group.machine_count} machines will become Ungrouped. Send force=true to delete it anyway.`,
          });
        }
        const machineIds = await movesRepository.ungroupMachines(
          client,
          actor.tenantId,
          groupId,
        );
        const userIds = await movesRepository.deleteGroupAccess(
          client,
          actor.tenantId,
          groupId,
        );
        await groupsRepository.softDeleteGroup(client, actor.tenantId, groupId);
        return {
          result: undefined,
          audit: {
            action: 'delete',
            entityType: 'machine_group',
            entityId: groupId,
            metadata: {
              name: group.name,
              ungroupedMachineIds: machineIds,
              removedUserIds: userIds,
            },
          },
        };
      },
    );

  private requireGroup = async (
    client: PoolClient,
    actor: AuthenticatedUser,
    groupId: string,
  ): Promise<MachineGroupRow> => {
    const row = await groupsRepository.findGroup(
      client,
      actor.tenantId,
      groupId,
    );
    if (!row) throw new NotFoundException(GROUP_NOT_FOUND_MESSAGE);
    return row;
  };
}
