export type AuthProvider = 'password' | 'google' | 'apple';

export interface CognitoIdentity {
  cognitoSub: string;
  email: string;
  emailVerified: boolean;
  authProvider: AuthProvider;
  // Only used when the sign-in creates a new FIELD account.
  firstName: string;
  lastName: string;
  // Google's `picture` claim (needs the attribute mapped on the user pool);
  // null for Apple, email/password, or when not mapped.
  pictureUrl: string | null;
}
