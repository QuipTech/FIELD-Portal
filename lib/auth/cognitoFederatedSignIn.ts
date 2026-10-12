import { AuthError, fetchAuthSession, signInWithRedirect, signOut } from "aws-amplify/auth";
import type { SignInMethod } from "../types/authSession";
import { configureAmplify } from "./amplifyConfig";
import { logAuthDebug } from "./authDebugLog";

export type FederatedProvider = "Google" | "Apple";

const USER_ALREADY_AUTHENTICATED = "UserAlreadyAuthenticatedException";

// Without this, Google silently reuses whichever account is already signed
// in to the browser; people with several Google accounts need to choose.
// Cognito forwards `prompt` to Google. Apple has no account chooser.
const promptForProvider = (provider: FederatedProvider) =>
  provider === "Google" ? { prompt: "SELECT_ACCOUNT" as const } : undefined;

export const signInWithFederatedProvider = async (provider: FederatedProvider): Promise<void> => {
  configureAmplify();
  try {
    await signInWithRedirect({ provider, options: promptForProvider(provider) });
  } catch (error) {
    // A Cognito session from an earlier, failed sign-in is still stored.
    // Reusing it would replay a stale ID token (e.g. from before an attribute
    // mapping fix), so drop it — this goes through Cognito's logout and lands
    // back on /login, where the next click starts a fresh sign-in.
    if (error instanceof AuthError && error.name === USER_ALREADY_AUTHENTICATED) {
      await signOut();
      return;
    }
    throw error;
  }
};

export interface CognitoSession {
  idToken: string;
  email: string;
  // Google/Apple tokens carry an `identities` claim; a user-pool
  // (email/password) sign-in doesn't.
  signInMethod: SignInMethod;
}

// Works for every Cognito sign-in: Google/Apple redirects and email/password.
export const getCognitoSession = async (): Promise<CognitoSession | null> => {
  configureAmplify();
  const { tokens } = await fetchAuthSession();
  if (!tokens?.idToken) return null;
  const { payload } = tokens.idToken;
  // `picture`, `given_name`, `identities`… exactly as Cognito issued them.
  logAuthDebug("Cognito ID token claims", payload);
  return {
    idToken: tokens.idToken.toString(),
    email: typeof payload.email === "string" ? payload.email : "",
    signInMethod: payload.identities ? "federated" : "password",
  };
};

// Clears Amplify's stored tokens. For a Google/Apple session it also sends
// the browser through Cognito's hosted-UI logout (back to /login), so the
// next person on a shared device isn't silently signed in as this user.
// For an email/password session it only clears the local tokens.
export const signOutOfCognito = async (): Promise<void> => {
  configureAmplify();
  await signOut();
};
