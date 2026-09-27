import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AdminDeleteUserCommand,
  CognitoIdentityProviderClient,
  ListUsersCommand,
  UserNotFoundException,
} from '@aws-sdk/client-cognito-identity-provider';
import { AccountIdentityRow } from './types/userRows';

type CognitoLookupAttribute = 'email' | 'sub';

// User pool IDs are `<region>_<id>`, so the region needs no extra env var.
const regionFromUserPoolId = (userPoolId: string) => userPoolId.split('_')[0];

const buildListUsersFilter = (
  attribute: CognitoLookupAttribute,
  value: string,
) => `${attribute} = "${value.replace(/["\\]/g, '\\$&')}"`;

// Credentials come from the AWS SDK default chain (IAM role, or
// AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY) and need cognito-idp:ListUsers
// and cognito-idp:AdminDeleteUser on this user pool.
@Injectable()
export class CognitoUserDeletionService {
  private readonly userPoolId: string;
  private readonly client: CognitoIdentityProviderClient;

  constructor(configService: ConfigService) {
    this.userPoolId = configService.getOrThrow<string>('COGNITO_USER_POOL_ID');
    this.client = new CognitoIdentityProviderClient({
      region: regionFromUserPoolId(this.userPoolId),
    });
  }

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
    await Promise.all([...usernames].map(this.deleteCognitoUser));
  };

  private findUsernames = async (
    attribute: CognitoLookupAttribute,
    value: string,
  ): Promise<string[]> => {
    const response = await this.client.send(
      new ListUsersCommand({
        UserPoolId: this.userPoolId,
        Filter: buildListUsersFilter(attribute, value),
      }),
    );
    return (response.Users ?? []).flatMap((user) =>
      user.Username ? [user.Username] : [],
    );
  };

  private deleteCognitoUser = async (username: string): Promise<void> => {
    try {
      await this.client.send(
        new AdminDeleteUserCommand({
          UserPoolId: this.userPoolId,
          Username: username,
        }),
      );
    } catch (error) {
      // Already gone (e.g. a concurrent retry) is the outcome we wanted.
      if (!(error instanceof UserNotFoundException)) throw error;
    }
  };
}
