import { Injectable } from '@nestjs/common';
import { AccountIdentityRow } from './types/userRows';
import {
  CognitoLookupAttribute,
  CognitoUserDirectoryService,
} from './cognitoUserDirectory.service';

@Injectable()
export class CognitoUserDeletionService {
  constructor(private readonly userDirectory: CognitoUserDirectoryService) {}

  // Signing in with Google and later Apple creates two Cognito users for
  // one FIELD account, but users.cognito_sub only holds the latest — so
  // look up by email too, and delete every match.
  deleteCognitoUsersForAccount = async (
    account: AccountIdentityRow,
  ): Promise<void> => {
    const usernames = await this.findAccountUsernames(account);
    await Promise.all(usernames.map(this.userDirectory.deleteUser));
  };

  // An admin removing someone: their sign-ins are disabled rather than
  // deleted, so signing in again says why instead of "wrong password".
  disableCognitoUsersForAccount = async (
    account: AccountIdentityRow,
  ): Promise<void> => {
    const usernames = await this.findAccountUsernames(account);
    await Promise.all(usernames.map(this.userDirectory.disableUser));
  };

  // Re-inviting a removed person: their disabled sign-ins go, so Cognito
  // can create the invited one.
  deleteCognitoUsersForEmail = async (email: string): Promise<void> => {
    const usernames = await this.findUsernames('email', email);
    await Promise.all(usernames.map(this.userDirectory.deleteUser));
  };

  private findAccountUsernames = async (
    account: AccountIdentityRow,
  ): Promise<string[]> => {
    const lookups = [this.findUsernames('email', account.email)];
    if (account.cognito_sub) {
      lookups.push(this.findUsernames('sub', account.cognito_sub));
    }
    return [...new Set((await Promise.all(lookups)).flat())];
  };

  private findUsernames = async (
    attribute: CognitoLookupAttribute,
    value: string,
  ): Promise<string[]> =>
    (await this.userDirectory.findUsers(attribute, value)).flatMap((user) =>
      user.Username ? [user.Username] : [],
    );
}
