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
    const lookups = [this.findUsernames('email', account.email)];
    if (account.cognito_sub) {
      lookups.push(this.findUsernames('sub', account.cognito_sub));
    }
    const usernames = new Set((await Promise.all(lookups)).flat());
    await Promise.all([...usernames].map(this.userDirectory.deleteUser));
  };

  private findUsernames = async (
    attribute: CognitoLookupAttribute,
    value: string,
  ): Promise<string[]> =>
    (await this.userDirectory.findUsers(attribute, value)).flatMap((user) =>
      user.Username ? [user.Username] : [],
    );
}
