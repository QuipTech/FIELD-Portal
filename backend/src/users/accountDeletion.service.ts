import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import * as usersRepository from './users.repository';
import { CognitoUserDeletionService } from './cognitoUserDeletion.service';
import { StorageService } from '../storage/storage.service';
import { AccountIdentityRow } from './types/userRows';

const ACCOUNT_NOT_FOUND_MESSAGE = 'Account not found.';
const COGNITO_UNAVAILABLE_MESSAGE =
  "We couldn't remove your sign-in right now. Nothing was deleted — please try again.";

@Injectable()
export class AccountDeletionService {
  private readonly logger = new Logger(AccountDeletionService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly cognitoUserDeletionService: CognitoUserDeletionService,
    private readonly storageService: StorageService,
  ) {}

  // Cognito goes first: if it fails nothing is deleted and the user can
  // retry. If the database step then fails, a retry finds no Cognito users
  // and just finishes the database delete.
  deleteOwnAccount = async (
    userId: string,
    tenantId: string,
  ): Promise<void> => {
    const account = await usersRepository.findAccountIdentity(
      this.databaseService,
      { userId, tenantId },
    );
    if (!account) throw new NotFoundException(ACCOUNT_NOT_FOUND_MESSAGE);

    await this.deleteCognitoUsers(userId, account);

    const deleted = await usersRepository.deleteUserAccount(
      this.databaseService,
      { userId, tenantId },
    );
    if (!deleted) throw new NotFoundException(ACCOUNT_NOT_FOUND_MESSAGE);

    // Best effort: the account is already gone; an orphaned avatar file is
    // logged rather than turning a finished deletion into an error.
    if (account.avatar_storage_key) {
      await this.storageService
        .deleteFile(account.avatar_storage_key, tenantId)
        .catch((error: unknown) =>
          this.logger.warn(
            `Couldn't delete avatar for user ${userId}: ${String(error)}`,
          ),
        );
    }
  };

  private deleteCognitoUsers = async (
    userId: string,
    account: AccountIdentityRow,
  ): Promise<void> => {
    try {
      await this.cognitoUserDeletionService.deleteCognitoUsersForAccount(
        account,
      );
    } catch (error) {
      this.logger.error(
        `Cognito deletion failed for user ${userId}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new ServiceUnavailableException(COGNITO_UNAVAILABLE_MESSAGE);
    }
  };
}
