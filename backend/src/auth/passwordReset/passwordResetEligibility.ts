import { UserType } from '@aws-sdk/client-cognito-identity-provider';

export type FederatedProviderName = 'google' | 'apple';

// What POST /auth/password-reset/check tells the portal before it asks
// Cognito to email a reset code.
export type PasswordResetEligibility =
  | { status: 'eligible' }
  // No Cognito user has this email.
  | { status: 'notFound' }
  // Only Google/Apple logins: there's no password to reset.
  | { status: 'federatedOnly'; provider: FederatedProviderName }
  // A password login that never verified its email; Cognito can't send a
  // reset code to an unverified address.
  | { status: 'unverified' };

const FEDERATED_STATUS = 'EXTERNAL_PROVIDER';
const UNCONFIRMED_STATUS = 'UNCONFIRMED';

// Cognito names federated users "<provider>_<id>", lower-cased.
const providerFromUsername = (username = ''): FederatedProviderName =>
  username.startsWith('signinwithapple_') ? 'apple' : 'google';

export const classifyPasswordResetEligibility = (
  users: UserType[],
): PasswordResetEligibility => {
  // Disabled users can't reset either, so they count as not found.
  const enabledUsers = users.filter((user) => user.Enabled !== false);
  const passwordUsers = enabledUsers.filter(
    (user) => user.UserStatus !== FEDERATED_STATUS,
  );

  if (passwordUsers.some((user) => user.UserStatus !== UNCONFIRMED_STATUS)) {
    return { status: 'eligible' };
  }
  if (passwordUsers.length > 0) return { status: 'unverified' };

  const federatedUser = enabledUsers[0];
  if (federatedUser) {
    return {
      status: 'federatedOnly',
      provider: providerFromUsername(federatedUser.Username),
    };
  }
  return { status: 'notFound' };
};
