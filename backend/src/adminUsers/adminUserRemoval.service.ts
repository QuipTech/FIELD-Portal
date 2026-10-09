import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { StorageService } from '../storage/storage.service';
import { CognitoUserDeletionService } from '../users/cognitoUserDeletion.service';
import * as removalRepository from './adminUserRemoval.repository';

const OWN_ACCOUNT_MESSAGE =
  "You can't remove yourself here. Use Settings → Delete account instead.";
const USER_NOT_FOUND_MESSAGE = 'User not found.';
const LAST_OWNER_MESSAGE =
  'This is the last Owner. Make someone else an Owner first, or no one could manage FIELD.';
const COGNITO_UNAVAILABLE_MESSAGE =
  "We couldn't disable their sign-in right now, so nothing was removed. Please try again.";

// Users → Remove user (the Owner, via AdminScopeGuard): deletes the
// person's FIELD account completely, like deleting your own, in any
// organisation. Their Cognito sign-ins are disabled first — if that fails
// nothing is removed — so their next sign-in says an administrator removed
// them (removed_accounts covers a first-time Google/Apple sign-in too).
@Injectable()
export class AdminUserRemovalService {
  private readonly logger = new Logger(AdminUserRemovalService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly cognitoUsers: CognitoUserDeletionService,
    private readonly storageService: StorageService,
  ) {}

  removeUser = async (
    actor: AuthenticatedUser,
    userId: string,
  ): Promise<void> => {
    if (userId === actor.userId) {
      throw new BadRequestException(OWN_ACCOUNT_MESSAGE);
    }
    const target = await removalRepository.findRemovableUser(
      this.databaseService,
      userId,
    );
    if (!target) throw new NotFoundException(USER_NOT_FOUND_MESSAGE);

    // The last-Owner rule is checked again (and enforced) when removing;
    // checking it first avoids disabling a sign-in that then stays.
    if (target.is_last_owner) {
      throw new ConflictException(LAST_OWNER_MESSAGE);
    }
    await this.disableSignIns(userId, target);

    const outcome = await removalRepository.removeUser(this.databaseService, {
      userId,
      removedBy: actor.userId,
    });
    if (outcome === 'not_found') {
      throw new NotFoundException(USER_NOT_FOUND_MESSAGE);
    }
    if (outcome === 'last_owner') {
      throw new ConflictException(LAST_OWNER_MESSAGE);
    }
    if (target.avatar_storage_key) {
      await this.storageService
        .deleteFile(target.avatar_storage_key, target.tenant_id)
        .catch((error: unknown) =>
          this.logger.warn(
            `Couldn't delete avatar for removed user ${userId}: ${String(error)}`,
          ),
        );
    }
  };

  private disableSignIns = async (
    userId: string,
    target: removalRepository.RemovableUserRow,
  ): Promise<void> => {
    try {
      await this.cognitoUsers.disableCognitoUsersForAccount(target);
    } catch (error) {
      this.logger.error(
        `Disabling Cognito sign-in failed for user ${userId}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new ServiceUnavailableException(COGNITO_UNAVAILABLE_MESSAGE);
    }
  };
}
