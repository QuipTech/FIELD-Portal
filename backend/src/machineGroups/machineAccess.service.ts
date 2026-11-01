import { Injectable, NotFoundException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { runAuditedChange } from '../common/audit/runAuditedChange';
import { findUserPermissionCodes } from '../auth/userAccess.repository';
import * as accessRepository from './machineAccess.repository';
import * as groupsRepository from './machineGroups.repository';
import { isMachineAccessAdmin, MachineAccessMode } from './access/machineScope';
import {
  MachineAccessChange,
  assertGroupsFound,
  toMachineAccessChange,
} from './access/machineAccessRules';
import { toAccessSnapshot, toMachineAccess } from './machineGroupsMapper';
import { MachineAccess } from './types/machineGroupTypes';

const USER_NOT_FOUND_MESSAGE = 'User not found.';
const ACCESS_CONFLICT_MESSAGE =
  'Machine access was changed at the same time. Try again.';

// Which machine groups a person sees: read for /team and /auth/me, set by
// an organisation admin (PATCH /team/:userId/machine-access) or when
// inviting. A change applies on the person's next request.
@Injectable()
export class MachineAccessService {
  constructor(private readonly databaseService: DatabaseService) {}

  // Keyed by user id; people not found are left out.
  listAccess = (
    tenantId: string,
    userIds: string[],
  ): Promise<Map<string, MachineAccess>> =>
    this.databaseService.withTenant(tenantId, async (client) => {
      const rows = await accessRepository.findUsersMachineAccess(
        client,
        tenantId,
        userIds,
      );
      return new Map(rows.map((row) => [row.user_id, toMachineAccess(row)]));
    });

  getAccess = async (
    tenantId: string,
    userId: string,
  ): Promise<MachineAccess> => {
    const access = (await this.listAccess(tenantId, [userId])).get(userId);
    if (!access) throw new NotFoundException(USER_NOT_FOUND_MESSAGE);
    return access;
  };

  // Audited with the access before and after. The person must be in the
  // caller's organisation (else 404).
  setAccess = (
    actor: AuthenticatedUser,
    userId: string,
    input: { mode: MachineAccessMode; groupIds?: string[] },
  ): Promise<MachineAccess> =>
    runAuditedChange(
      this.databaseService,
      actor,
      ACCESS_CONFLICT_MESSAGE,
      async (client) => {
        const before = await this.readAccess(client, actor.tenantId, userId);
        const change = toMachineAccessChange({
          ...input,
          targetIsAdmin: isMachineAccessAdmin(
            await findUserPermissionCodes(client, userId),
          ),
        });
        await assertChangeGroups(client, actor.tenantId, change);
        await accessRepository.replaceUserMachineAccess(client, {
          tenantId: actor.tenantId,
          userId,
          ...change,
        });
        const after = await this.readAccess(client, actor.tenantId, userId);
        return {
          result: after,
          audit: {
            action: 'update',
            entityType: 'user',
            entityId: userId,
            metadata: {
              change: 'machine_access',
              before: toAccessSnapshot(before),
              after: toAccessSnapshot(after),
            },
          },
        };
      },
    );

  // Checks an invitation's machine access before anyone is emailed:
  // valid for the role and every group in the organisation invited to.
  checkInviteAccess = (
    tenantId: string,
    input: { mode?: MachineAccessMode; groupIds?: string[] },
    roleIsAdmin: boolean,
  ): Promise<MachineAccessChange> =>
    this.databaseService.withTenant(tenantId, async (client) => {
      const change = toMachineAccessChange({
        mode: input.mode ?? 'all',
        groupIds: input.groupIds,
        targetIsAdmin: roleIsAdmin,
      });
      await assertChangeGroups(client, tenantId, change);
      return change;
    });

  private readAccess = async (
    client: PoolClient,
    tenantId: string,
    userId: string,
  ): Promise<MachineAccess> => {
    const [row] = await accessRepository.findUsersMachineAccess(
      client,
      tenantId,
      [userId],
    );
    if (!row) throw new NotFoundException(USER_NOT_FOUND_MESSAGE);
    return toMachineAccess(row);
  };
}

const assertChangeGroups = async (
  client: PoolClient,
  tenantId: string,
  change: MachineAccessChange,
): Promise<void> => {
  if (!change.groupIds.length) return;
  const found = await groupsRepository.findLiveGroups(
    client,
    tenantId,
    change.groupIds,
  );
  assertGroupsFound(
    change.groupIds,
    found.map((group) => group.id),
  );
};

// Saves an invited person's machine access inside the invitation's
// transaction. The Owner may invite into another organisation, whose rows
// RLS only accepts under that organisation's context, so it's switched
// for these statements and back to the inviter's for the audit entry.
export const saveInvitedAccess = async (
  client: PoolClient,
  params: {
    inviterTenantId: string;
    tenantId: string;
    userId: string;
    change: MachineAccessChange;
  },
): Promise<void> => {
  if (params.change.mode === 'all') return;
  const setTenant = (tenantId: string) =>
    client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
  await setTenant(params.tenantId);
  await accessRepository.replaceUserMachineAccess(client, {
    tenantId: params.tenantId,
    userId: params.userId,
    ...params.change,
  });
  await setTenant(params.inviterTenantId);
};
