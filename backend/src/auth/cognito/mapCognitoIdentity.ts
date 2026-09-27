import { UnauthorizedException } from '@nestjs/common';
import { CognitoIdTokenPayload } from 'aws-jwt-verify/jwt-model';
import { AuthProvider, CognitoIdentity } from '../types/cognitoIdentity';

// Keys are the provider names configured on the Cognito User Pool.
const FEDERATED_PROVIDERS: Record<string, AuthProvider> = {
  Google: 'google',
  SignInWithApple: 'apple',
};

// No `identities` claim means the user signed in against the Cognito user
// pool directory itself (email/password), not a federated provider.
const resolveAuthProvider = (payload: CognitoIdTokenPayload): AuthProvider => {
  const providerName = payload.identities?.[0]?.providerName;
  if (!providerName) return 'password';
  const provider = FEDERATED_PROVIDERS[providerName];
  if (!provider) {
    throw new UnauthorizedException('Unsupported sign-in provider.');
  }
  return provider;
};

// Federated attribute mappings often deliver email_verified as the string
// "true" rather than a boolean, despite the declared claim type.
const isEmailVerified = (payload: CognitoIdTokenPayload): boolean =>
  String(payload.email_verified) === 'true';

const readStringClaim = (
  payload: CognitoIdTokenPayload,
  claim: string,
): string => {
  const value = payload[claim];
  return typeof value === 'string' ? value.trim() : '';
};

// Name claims depend on each provider's attribute mapping, and Apple only
// shares the name on the very first authorisation — fall back to `name`,
// then to the email's local part, so a new account always has a name.
const resolveUserName = (payload: CognitoIdTokenPayload, email: string) => {
  const givenName = readStringClaim(payload, 'given_name');
  const familyName = readStringClaim(payload, 'family_name');
  if (givenName) return { firstName: givenName, lastName: familyName };

  const [firstName, ...rest] = readStringClaim(payload, 'name').split(/\s+/);
  if (firstName) return { firstName, lastName: rest.join(' ') };

  return { firstName: email.split('@')[0], lastName: '' };
};

// Rendered as an <img> src in the portal, so only an https URL is kept.
const resolvePictureUrl = (payload: CognitoIdTokenPayload): string | null => {
  const picture = readStringClaim(payload, 'picture');
  try {
    return new URL(picture).protocol === 'https:' ? picture : null;
  } catch {
    return null;
  }
};

export const mapCognitoIdentity = (
  payload: CognitoIdTokenPayload,
): CognitoIdentity => {
  if (typeof payload.email !== 'string' || !payload.email) {
    throw new UnauthorizedException('Cognito token has no email claim.');
  }
  return {
    cognitoSub: payload.sub,
    email: payload.email,
    emailVerified: isEmailVerified(payload),
    authProvider: resolveAuthProvider(payload),
    ...resolveUserName(payload, payload.email),
    pictureUrl: resolvePictureUrl(payload),
  };
};
