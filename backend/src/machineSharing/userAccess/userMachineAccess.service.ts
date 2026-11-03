import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../../database/database.service';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { runAuditedChange } from '../../common/audit/runAuditedChange';
import { runInTenantContext } from '../../database/runInTenantContext';
import { findUserPermissionCodes } from '../../auth/userAccess.repository';
import {
  isMachineAccessAdmin,
  MachineAccessMode,
} from '../access/machineScope';
import * as accessRepository from './userMachineAccess.repository';
import { MachineAccess } from '../types/machineGroupTypes';

const USER_NOT_FOUND_MESSAGE = 'User not found.';
const ADMIN_ALL_MACHINES_MESSAGE =
  "Organisation admins always see their organisation's machines, so they can't be limited to shared groups.";

// Which machines a person sees: 'all' (their organisation's machines plus
// shared groups) or 'groups_only' (only machines in groups assigned to them
// or their organisation). Read for /auth/me, /team and /admin/users; set
// by the platform administrator. A change applies on the next request.
@Injectable()
export class UserMachineAccessService {
  constructor(private readonly databaseService: DatabaseService) {}

  // Keyed by user id. The caller's organisation in tenantId; the platform
  // administrator may ask about anyone.
  listAccess = (
    actor: AuthenticatedUser,
    userIds: string[],
  ): Promise<Map<string, MachineAccess>> =>
    this.databaseService.withActor(actor, (client) =>
      accessRepository.findUsersMachineAccess(client, userIds),
    );

  getAccess = async (
    actor: AuthenticatedUser,
    userId: string,
  ): Promise<MachineAccess> => {
    const access = (await this.listAccess(actor, [userId])).get(userId);
    if (!access) throw new NotFoundException(USER_NOT_FOUND_MESSAGE);
    return access;
  };

  // Audited with the mode before and after. tenantId is the person's
  // organisation (the platform administrator changes anyone's).
  setMode = (
    actor: AuthenticatedUser,
    target: { userId: string; tenantId: string },
    mode: MachineAccessMode,
  ): Promise<MachineAccess> =>
    runAuditedChange(this.databaseService, actor, '', async (client) => {
      const before = await this.requireAccess(client, target.userId);
      await runInTenantContext(
        client,
        { tenantId: target.tenantId, returnToTenantId: actor.tenantId },
        () => this.saveMode(client, target, mode),
      );
      const after = await this.requireAccess(client, target.userId);
      return {
        result: after,
        audit: {
          action: 'update',
          entityType: 'user',
          entityId: target.userId,
          metadata: {
            change: 'machine_access',
            organisationId: target.tenantId,
            before: before.machineAccessMode,
            after: after.machineAccessMode,
          },
        },
      };
    });

  private saveMode = async (
    client: PoolClient,
    target: { userId: string; tenantId: string },
    mode: MachineAccessMode,
  ): Promise<void> => {
    const permissions = await findUserPermissionCodes(client, target.userId);
    if (mode === 'groups_only' && isMachineAccessAdmin(permissions)) {
      throw new BadRequestException(ADMIN_ALL_MACHINES_MESSAGE);
    }
    const isUpdated = await accessRepository.updateMachineAccessMode(client, {
      ...target,
      mode,
    });
    if (!isUpdated) throw new NotFoundException(USER_NOT_FOUND_MESSAGE);
  };

  private requireAccess = async (
    client: PoolClient,
    userId: string,
  ): Promise<MachineAccess> => {
    const access = (
      await accessRepository.findUsersMachineAccess(client, [userId])
    ).get(userId);
    if (!access) throw new NotFoundException(USER_NOT_FOUND_MESSAGE);
    return access;
  };
}
