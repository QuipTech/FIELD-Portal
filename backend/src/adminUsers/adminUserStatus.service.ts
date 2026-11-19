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
import { SetUserStatusDto } from './dto/setUserStatusDto';

const OWN_STATUS_MESSAGE = "You can't disable your own account.";
const USER_NOT_FOUND_MESSAGE = 'User not found.';
const LAST_OWNER_MESSAGE =
  'This is the last Owner. Make someone else an Owner first, or no one could manage FIELD.';

// Users → Disable user / Enable user: keeps the account but blocks (or
// restores) sign-in. Unlike Remove user, nothing is deleted. Owners only
// (the route's AdminScopeGuard); audited.
@Injectable()
export class AdminUserStatusService {
  constructor(private readonly databaseService: DatabaseService) {}

  setStatus = async (
    actor: AuthenticatedUser,
    userId: string,
    dto: SetUserStatusDto,
  ): Promise<void> => {
    if (userId === actor.userId) {
      throw new BadRequestException(OWN_STATUS_MESSAGE);
    }
    await runAuditedChange(
      this.databaseService,
      actor,
      USER_NOT_FOUND_MESSAGE,
      async (client) => {
        const outcome = await adminUsersRepository.setUserDisabled(client, {
          userId,
          disabled: dto.status === 'disabled',
        });
        if (outcome === 'not_found') {
          throw new NotFoundException(USER_NOT_FOUND_MESSAGE);
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
            metadata: { status: dto.status },
          },
        };
      },
    );
  };
}
