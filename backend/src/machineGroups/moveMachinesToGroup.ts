import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PoolClient } from 'pg';
import * as authRepository from '../auth/auth.repository';
import * as groupsRepository from './machineGroups.repository';
import * as movesRepository from './machineGroupMoves.repository';

export const GROUP_NOT_FOUND_MESSAGE = 'Machine group not found.';
const MACHINE_NOT_FOUND_MESSAGE = 'Machine not found.';

export interface MoveResult {
  // Machines whose group changed.
  moved: number;
  // Machines already in that group.
  unchanged: number;
}

// Puts machines into a group (or none, groupId null), inside the caller's
// transaction. Each machine whose group changes gets its own audit entry
// with the group before and after. Any machine id that isn't a live
// machine of the organisation fails the whole move (404), so nothing moves
// half-way. Who may move machines is checked by the caller.
export const moveMachinesToGroup = async (
  client: PoolClient,
  actor: { tenantId: string; userId: string },
  params: { machineIds: string[]; groupId: string | null },
): Promise<MoveResult> => {
  const [target] = params.groupId
    ? await groupsRepository.findLiveGroups(client, actor.tenantId, [
        params.groupId,
      ])
    : [null];
  if (params.groupId && !target) {
    throw new BadRequestException(GROUP_NOT_FOUND_MESSAGE);
  }
  const machineIds = Array.from(new Set(params.machineIds));
  const machines = await movesRepository.findMachinesForMove(
    client,
    actor.tenantId,
    machineIds,
  );
  if (machines.length !== machineIds.length) {
    throw new NotFoundException(MACHINE_NOT_FOUND_MESSAGE);
  }
  const changing = machines.filter(
    (machine) => machine.group_id !== params.groupId,
  );
  if (changing.length) {
    await movesRepository.setMachinesGroup(client, {
      tenantId: actor.tenantId,
      machineIds: changing.map((machine) => machine.id),
      groupId: params.groupId,
    });
  }
  for (const machine of changing) {
    await authRepository.insertAuditLog(client, {
      tenantId: actor.tenantId,
      userId: actor.userId,
      action: 'update',
      entityType: 'machine',
      entityId: machine.id,
      metadata: {
        name: machine.label,
        change: 'group',
        before: { groupId: machine.group_id, groupName: machine.group_name },
        after: { groupId: params.groupId, groupName: target?.name ?? null },
      },
    });
  }
  return {
    moved: changing.length,
    unchanged: machines.length - changing.length,
  };
};
