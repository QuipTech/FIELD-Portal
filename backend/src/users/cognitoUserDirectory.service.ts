import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminDisableUserCommand,
  CognitoIdentityProviderClient,
  ListUsersCommand,
  UserNotFoundException,
  UserType,
} from '@aws-sdk/client-cognito-identity-provider';

export type CognitoLookupAttribute = 'email' | 'sub';

// User pool IDs are `<region>_<id>`, so the region needs no extra env var.
const regionFromUserPoolId = (userPoolId: string) => userPoolId.split('_')[0];

const buildListUsersFilter = (
  attribute: CognitoLookupAttribute,
  value: string,
) => `${attribute} = "${value.replace(/["\\]/g, '\\$&')}"`;

// Admin access to the Cognito user pool (COGNITO_USER_POOL_ID). Credentials
// come from the AWS SDK default chain (IAM role, or AWS_ACCESS_KEY_ID /
// AWS_SECRET_ACCESS_KEY) and need cognito-idp:ListUsers,
// cognito-idp:AdminDeleteUser, cognito-idp:AdminDisableUser (an admin
// removing a user) and (for invitations) cognito-idp:AdminCreateUser on
// this user pool.
@Injectable()
export class CognitoUserDirectoryService {
  private readonly userPoolId: string;
  private readonly client: CognitoIdentityProviderClient;

  constructor(configService: ConfigService) {
    this.userPoolId = configService.getOrThrow<string>('COGNITO_USER_POOL_ID');
    this.client = new CognitoIdentityProviderClient({
      region: regionFromUserPoolId(this.userPoolId),
    });
  }

  // One email can belong to several Cognito users: a password login plus a
  // Google and/or Apple one.
  findUsers = async (
    attribute: CognitoLookupAttribute,
    value: string,
  ): Promise<UserType[]> => {
    const response = await this.client.send(
      new ListUsersCommand({
        UserPoolId: this.userPoolId,
        Filter: buildListUsersFilter(attribute, value),
      }),
    );
    return response.Users ?? [];
  };

  // Creates the person in the pool with a verified email; Cognito emails
  // them a temporary password, which they replace on first sign-in.
  // Resolves to the new user's sub and username.
  createInvitedUser = async (params: {
    email: string;
    firstName: string;
    lastName: string;
  }): Promise<{ sub: string; username: string }> => {
    const response = await this.client.send(
      new AdminCreateUserCommand({
        UserPoolId: this.userPoolId,
        Username: params.email,
        DesiredDeliveryMediums: ['EMAIL'],
        UserAttributes: [
          { Name: 'email', Value: params.email },
          { Name: 'email_verified', Value: 'true' },
          { Name: 'given_name', Value: params.firstName },
          { Name: 'family_name', Value: params.lastName },
        ],
      }),
    );
    const sub = response.User?.Attributes?.find(
      (attribute) => attribute.Name === 'sub',
    )?.Value;
    if (!sub || !response.User?.Username) {
      throw new Error('Cognito created the user without a sub.');
    }
    return { sub, username: response.User.Username };
  };

  deleteUser = async (username: string): Promise<void> => {
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

  // Sign-in then fails with "User is disabled.", which the portal shows as
  // "an administrator removed your account".
  disableUser = async (username: string): Promise<void> => {
    try {
      await this.client.send(
        new AdminDisableUserCommand({
          UserPoolId: this.userPoolId,
          Username: username,
        }),
      );
    } catch (error) {
      if (!(error instanceof UserNotFoundException)) throw error;
    }
  };
}
