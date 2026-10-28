import {
  ForbiddenException,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import { BillingSignUpService } from '../billing/signUp/billingSignUp.service';
import { DatabaseService } from '../database/database.service';
import * as authRepository from '../auth/auth.repository';
import { UserRow } from '../auth/types/authRows';
import { CognitoIdentity } from '../auth/types/cognitoIdentity';
import * as usersRepository from './users.repository';
import { isRemovedAccount } from './removedAccounts.repository';
import { createTenantAndFirstUserFromCognito } from './cognitoSignup';
import {
  CognitoSignupProfile,
  CognitoUserResolution,
} from './types/cognitoUserResolution';

const SUSPENDED_TENANT_STATUS = 'suspended';
const ACCOUNT_UNAVAILABLE_MESSAGE =
  'This account is disabled or its organisation is suspended.';
// The portal shows this as is (and the same words when Cognito says the
// sign-in is disabled).
export const ACCOUNT_REMOVED_MESSAGE =
  'An administrator removed your FIELD account. Contact your administrator if you think this is a mistake.';
const UNVERIFIED_EMAIL_MESSAGE =
  'Verify your email address before signing in with this account.';

interface SignInCandidate {
  id: string;
  tenant_id: string;
  status: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  avatar_storage_key: string | null;
  tenant_status: string;
}

// An invited user (admin portal → Invite user) may sign in; their first
// sign-in makes them active (recordCognitoSignIn / linkCognitoIdentity).
const SIGN_IN_STATUSES = ['active', 'invited'];

const assertCanSignIn = (candidate: SignInCandidate): void => {
  if (
    !SIGN_IN_STATUSES.includes(candidate.status) ||
    candidate.tenant_status === SUSPENDED_TENANT_STATUS
  ) {
    throw new ForbiddenException(ACCOUNT_UNAVAILABLE_MESSAGE);
  }
};

// Linking by email hands over an existing account (and signing up claims
// the address), so the email must be proven. Google and Apple only release
// verified addresses, but a Cognito user-pool-directory account can exist
// with an unverified one.
const assertEmailTrusted = (identity: CognitoIdentity): void => {
  if (identity.authProvider === 'password' && !identity.emailVerified) {
    throw new ForbiddenException(UNVERIFIED_EMAIL_MESSAGE);
  }
};

// Mirrors what the sign-in just saved: the new photo, else the stored one.
const toUserRow = (
  candidate: SignInCandidate,
  identity: CognitoIdentity,
  email: string,
): UserRow => ({
  id: candidate.id,
  tenant_id: candidate.tenant_id,
  email,
  first_name: candidate.first_name,
  last_name: candidate.last_name,
  status: candidate.status,
  avatar_url: identity.pictureUrl ?? candidate.avatar_url,
  avatar_storage_key: candidate.avatar_storage_key,
});

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    @Optional() private readonly billingSignUp?: BillingSignUpService,
  ) {}

  // Login and signup are the same call: an existing account (by Cognito sub,
  // then by email) is signed in; otherwise a new one is created — but only
  // once the caller has sent the company name + phone number it needs, and
  // never for an email an admin removed.
  findOrCreateFromCognito = async (
    identity: CognitoIdentity,
    signupProfile?: CognitoSignupProfile,
  ): Promise<CognitoUserResolution> => {
    const existingUser = await this.findExistingUser(identity);
    if (existingUser) return { status: 'resolved', user: existingUser };
    // Removed by an admin: say so, rather than offering a new signup (e.g.
    // a first Google sign-in with the same email).
    if (await isRemovedAccount(this.databaseService, identity.email)) {
      throw new ForbiddenException(ACCOUNT_REMOVED_MESSAGE);
    }

    assertEmailTrusted(identity);
    if (!signupProfile) return { status: 'profileRequired' };

    const createdUser = await createTenantAndFirstUserFromCognito(
      this.databaseService,
      identity,
      signupProfile,
    );
    await this.startBilling(
      createdUser,
      identity.email,
      signupProfile.companyName,
    );
    return { status: 'resolved', user: createdUser };
  };

  // Billing spec T22: a new organisation starts on monthly ASSET_PRO
  // straight away (no trial), billed to the person who signed up. Nothing is
  // charged until a machine is activated. Best effort: the first activation
  // sets billing up anyway, so a failure here never blocks sign-up.
  private startBilling = async (
    user: UserRow,
    email: string,
    companyName: string,
  ): Promise<void> => {
    if (!this.billingSignUp) return;
    try {
      await this.billingSignUp.signUp(
        { userId: user.id, tenantId: user.tenant_id },
        {
          organisationId: user.tenant_id,
          name: companyName,
          abn: null,
          billingEmail: email,
          timezone: null,
          choice: { term: 'monthly' },
        },
      );
    } catch (error) {
      this.logger.warn(
        `Billing set-up for new organisation ${user.tenant_id} failed: ${String(error)}`,
      );
    }
  };

  private findExistingUser = async (
    identity: CognitoIdentity,
  ): Promise<UserRow | null> => {
    const linkedUser = await usersRepository.findUserByCognitoSub(
      this.databaseService,
      identity.cognitoSub,
    );
    if (linkedUser) {
      assertCanSignIn(linkedUser);
      await this.databaseService.withTenant(linkedUser.tenant_id, (client) =>
        usersRepository.recordCognitoSignIn(client, {
          userId: linkedUser.id,
          pictureUrl: identity.pictureUrl,
        }),
      );
      return toUserRow(linkedUser, identity, linkedUser.email);
    }

    const emailMatch = await authRepository.findUserByEmailForLogin(
      this.databaseService,
      identity.email,
    );
    if (!emailMatch) return null;

    assertEmailTrusted(identity);
    assertCanSignIn(emailMatch);
    // Overwrites any previously linked sub on purpose: signing in with
    // Google and later Apple (same verified email) yields two different
    // Cognito users, and both should reach the same FIELD account.
    await this.databaseService.withTenant(emailMatch.tenant_id, (client) =>
      usersRepository.linkCognitoIdentity(client, {
        userId: emailMatch.id,
        cognitoSub: identity.cognitoSub,
        authProvider: identity.authProvider,
        pictureUrl: identity.pictureUrl,
      }),
    );
    return toUserRow(emailMatch, identity, identity.email);
  };
}
