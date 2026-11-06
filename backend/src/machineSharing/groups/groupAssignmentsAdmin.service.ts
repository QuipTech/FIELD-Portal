import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../../database/database.service';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { runAuditedChange } from '../../common/audit/runAuditedChange';
import * as assignmentsRepository from './groupAssignments.repository';
import { auditForMachineOwners } from './auditForMachineOwners';
import { requireGroup } from './machineGroupsAdmin.service';
import { toGroupAssignment } from './machineGroupsMapper';
import { GrantAssignmentDto } from '../dto/machineGroupDtos';
import {
  AssignmentTargetType,
  GroupAssignment,
} from '../types/machineGroupTypes';

const TARGET_NOT_FOUND_MESSAGE: Record<AssignmentTargetType, string> = {
  organisation: 'Organisation not found.',
  user: 'User not found.',
};
const ASSIGNMENT_NOT_FOUND_MESSAGE = 'Assignment not found.';

// Who a global group is shared with: organisations (everyone in them) or
// individual people, at 'view' or 'contribute'. Granting, changing the
// level and revoking (with a reason) are audited for the platform
// administrator and in each owning organisation's log, and apply on the
// next request.
@Injectable()
export class GroupAssignmentsAdminService {
  constructor(private readonly databaseService: DatabaseService) {}

  listAssignments = (
    actor: AuthenticatedUser,
    groupId: string,
  ): Promise<GroupAssignment[]> =>
    this.databaseService.withActor(actor, async (client) => {
      await requireGroup(client, groupId);
      return this.loadAssignments(client, groupId);
    });

  grant = (
    actor: AuthenticatedUser,
    groupId: string,
    dto: GrantAssignmentDto,
  ): Promise<GroupAssignment[]> =>
    runAuditedChange(this.databaseService, actor, '', async (client) => {
      const group = await requireGroup(client, groupId);
      const targetName = await this.requireTargetName(client, dto);
      const existing = await assignmentsRepository.findActiveAssignmentFor(
        client,
        { groupId, targetType: dto.targetType, targetId: dto.targetId },
      );
      if (existing) {
        await assignmentsRepository.updateAssignmentLevel(client, {
          assignmentId: existing.id,
          accessLevel: dto.accessLevel,
        });
      } else {
        await assignmentsRepository.insertAssignment(client, {
          groupId,
          ...dto,
          grantedBy: actor.userId,
        });
      }
      const audit = {
        action: existing ? ('update' as const) : ('create' as const),
        entityType: 'machine_group',
        entityId: groupId,
        metadata: {
          name: group.name,
          change: existing ? 'assignment_level_changed' : 'assignment_granted',
          target: { type: dto.targetType, id: dto.targetId, name: targetName },
          ...(existing ? { before: existing.access_level } : {}),
          accessLevel: dto.accessLevel,
        },
      };
      await auditForMachineOwners(
        client,
        actor,
        await assignmentsRepository.listGroupMachineOwners(client, groupId),
        audit,
      );
      return { result: await this.loadAssignments(client, groupId), audit };
    });

  revoke = (
    actor: AuthenticatedUser,
    target: { groupId: string; assignmentId: string },
    reason: string,
  ): Promise<void> =>
    runAuditedChange(this.databaseService, actor, '', async (client) => {
      const group = await requireGroup(client, target.groupId);
      const assignment = await assignmentsRepository.findActiveAssignment(
        client,
        target,
      );
      if (!assignment)
        throw new NotFoundException(ASSIGNMENT_NOT_FOUND_MESSAGE);
      await assignmentsRepository.revokeAssignment(client, {
        assignmentId: assignment.id,
        revokedBy: actor.userId,
        reason,
      });
      const audit = {
        action: 'update' as const,
        entityType: 'machine_group',
        entityId: target.groupId,
        metadata: {
          name: group.name,
          change: 'assignment_revoked',
          target: { type: assignment.target_type, id: assignment.target_id },
          accessLevel: assignment.access_level,
          reason,
        },
      };
      await auditForMachineOwners(
        client,
        actor,
        await assignmentsRepository.listGroupMachineOwners(
          client,
          target.groupId,
        ),
        audit,
      );
      return { result: undefined, audit };
    });

  private loadAssignments = async (
    client: PoolClient,
    groupId: string,
  ): Promise<GroupAssignment[]> =>
    (await assignmentsRepository.listAssignments(client, groupId)).map(
      toGroupAssignment,
    );

  private requireTargetName = async (
    client: PoolClient,
    dto: GrantAssignmentDto,
  ): Promise<string> => {
    const name =
      dto.targetType === 'organisation'
        ? await assignmentsRepository.findOrganisationName(client, dto.targetId)
        : (await assignmentsRepository.findUserTarget(client, dto.targetId))
            ?.name;
    if (!name)
      throw new BadRequestException(TARGET_NOT_FOUND_MESSAGE[dto.targetType]);
    return name;
  };
}
