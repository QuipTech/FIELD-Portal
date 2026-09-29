export interface AuthSessionUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  // Saved from the Google profile photo; null when the user has none.
  avatarUrl: string | null;
  // Role names from the backend, e.g. ["Owner"]; drives the post-login route.
  roles: string[];
  // Permission codes those roles grant, e.g. "ai.use". Missing on sessions
  // saved before the backend sent them.
  permissions?: string[];
}

export interface AuthSessionTenant {
  id: string;
  name: string;
  slug: string;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: AuthSessionUser;
  tenant: AuthSessionTenant;
}

// Collected once, the first time someone signs in with Google/Apple.
export interface SignupProfile {
  companyName: string;
  phoneNumber: string;
}

export type CognitoSyncResponse =
  | { status: "signedIn"; session: AuthSession }
  | { status: "profileRequired" };

// How the current session was started. Google/Apple users have no FIELD
// password (and no FIELD-managed 2FA), so password settings don't apply.
export type SignInMethod = "password" | "federated";

export interface SignedInProfile {
  user: AuthSessionUser;
  tenant: AuthSessionTenant | null;
  signInMethod: SignInMethod;
}
