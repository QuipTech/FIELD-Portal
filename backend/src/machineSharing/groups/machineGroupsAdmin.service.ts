import { Injectable, NotFoundException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../../database/database.service';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { runAuditedChange } from '../../common/audit/runAuditedChange';
import * as groupsRepository from './machineGroups.repository';
import { listGroupMachineOwners } from './groupAssignments.repository';
import { auditForMachineOwners } from './auditForMachineOwners';
import { toGroupActivity, toMachineGroup } from './machineGroupsMapper';
import {
  CreateMachineGroupDto,
  UpdateMachineGroupDto,
} from '../dto/machineGroupDtos';
import {
  GroupActivity,
  MachineGroup,
  MachineGroupRow,
} from '../types/machineGroupTypes';

export const GROUP_NOT_FOUND_MESSAGE = 'Machine group not found.';
const DUPLICATE_NAME_MESSAGE = 'A machine group with this name already exists.';
const GROUP_DELETED_REASON = 'Group deleted';
const ACTIVITY_LIMIT = 100;

export const requireGroup = async (
  client: PoolClient,
  groupId: string,
): Promise<MachineGroupRow> => {
  const row = await groupsRepository.findGroup(client, groupId);
  if (!row) throw new NotFoundException(GROUP_NOT_FOUND_MESSAGE);
  return row;
};

// The platform administrator's global machine groups (Admin view →
// Machine groups): list with counts, create, edit, delete and the group's
// activity. Every change is audited; deleting also ends its assignments,
// so nobody sees its machines any more.
@Injectable()
export class MachineGroupsAdminService {
  constructor(private readonly databaseService: DatabaseService) {}

  listGroups = (actor: AuthenticatedUser): Promise<MachineGroup[]> =>
    this.databaseService.withActor(actor, async (client) =>
      (await groupsRepository.listGroups(client)).map(toMachineGroup),
    );

  getGroup = (
    actor: AuthenticatedUser,
    groupId: string,
  ): Promise<MachineGroup> =>
    this.databaseService.withActor(actor, async (client) =>
      toMachineGroup(await requireGroup(client, groupId)),
    );

  createGroup = (
    actor: AuthenticatedUser,
    dto: CreateMachineGroupDto,
  ): Promise<MachineGroup> =>
    runAuditedChange(
      this.databaseService,
      actor,
      DUPLICATE_NAME_MESSAGE,
      async (client) => {
        const groupId = await groupsRepository.insertGroup(client, {
          fields: dto,
          createdBy: actor.userId,
        });
        const group = toMachineGroup(await requireGroup(client, groupId));
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
        const before = toMachineGroup(await requireGroup(client, groupId));
        await groupsRepository.updateGroup(client, { groupId, fields: dto });
        const after = toMachineGroup(await requireGroup(client, groupId));
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

  deleteGroup = (actor: AuthenticatedUser, groupId: string): Promise<void> =>
    runAuditedChange(
      this.databaseService,
      actor,
      DUPLICATE_NAME_MESSAGE,
      async (client) => {
        const group = await requireGroup(client, groupId);
        const owners = await listGroupMachineOwners(client, groupId);
        await groupsRepository.softDeleteGroup(client, {
          groupId,
          deletedBy: actor.userId,
          reason: GROUP_DELETED_REASON,
        });
        const audit = {
          action: 'delete' as const,
          entityType: 'machine_group',
          entityId: groupId,
          metadata: {
            name: group.name,
            machineCount: group.machine_count,
            revokedAssignments: group.organisation_count + group.user_count,
          },
        };
        await auditForMachineOwners(client, actor, owners, audit);
        return { result: undefined, audit };
      },
    );

  listActivity = (
    actor: AuthenticatedUser,
    groupId: string,
  ): Promise<GroupActivity[]> =>
    this.databaseService.withActor(actor, async (client) => {
      await requireGroup(client, groupId);
      const rows = await groupsRepository.listGroupActivity(client, {
        tenantId: actor.tenantId,
        groupId,
        limit: ACTIVITY_LIMIT,
      });
      return rows.map(toGroupActivity);
    });
}
