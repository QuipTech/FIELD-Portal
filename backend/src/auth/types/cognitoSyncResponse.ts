import { AuthResponse } from './authResponse';

export type CognitoSyncResponse =
  { status: 'signedIn'; session: AuthResponse } | { status: 'profileRequired' };
