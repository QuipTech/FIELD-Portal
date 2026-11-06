import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { runAuditedChange } from '../../common/audit/runAuditedChange';
import { requireMachineAccess } from '../access/machineAccess';
import * as sharesRepository from './machineShares.repository';
import { MachineShare } from '../types/machineGroupTypes';

const SHARE_NOT_FOUND_MESSAGE = "This machine isn't shared that way.";
const ALREADY_WITHDRAWN_MESSAGE =
  'This machine was already withdrawn from that share.';

const toMachineShare = (
  row: sharesRepository.MachineShareRow,
): MachineShare => ({
  assignmentId: row.assignment_id,
  group: { id: row.group_id, name: row.group_name, colour: row.group_colour },
  targetType: row.target_type,
  targetName: row.target_name,
  organisationName: row.organisation_name,
  accessLevel: row.access_level,
  grantedAt: new Date(row.granted_at).toISOString(),
  withdrawnAt: row.withdrawn_at
    ? new Date(row.withdrawn_at).toISOString()
    : null,
  withdrawnReason: row.withdrawn_reason,
});

// The owning organisation's admins: who can see one of their machines
// through the platform administrator's groups, and withdrawing it from
// one share (the rest of the group, and the machine's other shares, stay
// as they are). A withdrawal is audited, with its reason, in their own
// log, and every platform administrator is notified.
@Injectable()
export class MachineSharesService {
  constructor(private readonly databaseService: DatabaseService) {}

  listShares = (
    actor: AuthenticatedUser,
    machineId: string,
  ): Promise<MachineShare[]> =>
    this.databaseService.withActor(actor, async (client) => {
      await requireMachineAccess(client, machineId, 'manage');
      const rows = await sharesRepository.listOwnedMachineShares(
        client,
        machineId,
      );
      return rows.map(toMachineShare);
    });

  withdrawShare = (
    actor: AuthenticatedUser,
    target: { machineId: string; assignmentId: string },
    reason: string,
  ): Promise<MachineShare[]> =>
    runAuditedChange(this.databaseService, actor, '', async (client) => {
      await requireMachineAccess(client, target.machineId, 'manage');
      const shares = await sharesRepository.listOwnedMachineShares(
        client,
        target.machineId,
      );
      const share = shares.find(
        (row) => row.assignment_id === target.assignmentId,
      );
      if (!share) throw new NotFoundException(SHARE_NOT_FOUND_MESSAGE);
      if (share.withdrawn_at) {
        throw new ConflictException(ALREADY_WITHDRAWN_MESSAGE);
      }
      await sharesRepository.insertShareExclusion(client, {
        tenantId: actor.tenantId,
        assignmentId: target.assignmentId,
        machineId: target.machineId,
        revokedBy: actor.userId,
        reason,
      });
      await sharesRepository.notifyShareRevoked(client, {
        machineId: target.machineId,
        groupId: share.group_id,
        reason,
      });
      const after = await sharesRepository.listOwnedMachineShares(
        client,
        target.machineId,
      );
      return {
        result: after.map(toMachineShare),
        audit: {
          action: 'update',
          entityType: 'machine',
          entityId: target.machineId,
          metadata: {
            change: 'share_withdrawn',
            group: { id: share.group_id, name: share.group_name },
            assignmentId: target.assignmentId,
            target: { type: share.target_type, name: share.target_name },
            accessLevel: share.access_level,
            reason,
          },
        },
      };
    });
}
