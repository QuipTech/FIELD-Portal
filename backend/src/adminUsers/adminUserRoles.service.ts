import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { runAuditedChange } from '../common/audit/runAuditedChange';
import * as adminUsersRepository from './adminUsers.repository';
import { ChangeUserRoleDto } from './dto/changeUserRoleDto';

const OWN_ROLE_MESSAGE =
  "You can't change your own role. Ask another Owner to do it.";
const USER_NOT_FOUND_MESSAGE = 'User not found.';
const ROLE_NOT_ALLOWED_MESSAGE =
  "That role can't be given to people in this user's organisation.";
const LAST_OWNER_MESSAGE =
  'This is the last Owner. Make someone else an Owner first, or no one could manage FIELD.';

// Users → Change role: one role per user, replacing what they held.
// Owners only (the route's AdminScopeGuard); audited.
@Injectable()
export class AdminUserRolesService {
  constructor(private readonly databaseService: DatabaseService) {}

  changeRole = async (
    actor: AuthenticatedUser,
    userId: string,
    dto: ChangeUserRoleDto,
  ): Promise<void> => {
    // Stops an Owner demoting themselves by accident.
    if (userId === actor.userId)
      throw new BadRequestException(OWN_ROLE_MESSAGE);
    await runAuditedChange(
      this.databaseService,
      actor,
      USER_NOT_FOUND_MESSAGE,
      async (client) => {
        const outcome = await adminUsersRepository.setUserRole(client, {
          userId,
          roleId: dto.roleId,
        });
        if (outcome === 'not_found') {
          throw new NotFoundException(USER_NOT_FOUND_MESSAGE);
        }
        if (outcome === 'role_not_allowed') {
          throw new BadRequestException(ROLE_NOT_ALLOWED_MESSAGE);
        }
        if (outcome === 'last_owner') {
          throw new ConflictException(LAST_OWNER_MESSAGE);
        }
        return {
          result: undefined,
          audit: {
            action: 'update',
            entityType: 'user',
            entityId: userId,
            metadata: { roleId: dto.roleId },
          },
        };
      },
    );
  };
}
