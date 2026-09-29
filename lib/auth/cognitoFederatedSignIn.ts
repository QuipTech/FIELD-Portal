import { AuthError, fetchAuthSession, signInWithRedirect, signOut } from "aws-amplify/auth";
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

export const getCognitoIdToken = async (): Promise<string | null> => {
  configureAmplify();
  const { tokens } = await fetchAuthSession();
  if (tokens?.idToken) {
    // `picture`, `given_name`, `identities`… exactly as Cognito issued them.
    logAuthDebug("Cognito ID token claims", tokens.idToken.payload);
  }
  return tokens?.idToken?.toString() ?? null;
};

// Clears Amplify's stored tokens. For a Google/Apple session it also sends
// the browser through Cognito's hosted-UI logout (back to /login), so the
// next person on a shared device isn't silently signed in as this user.
// Without a Cognito session (email/password users) it's a local no-op.
export const signOutOfCognito = async (): Promise<void> => {
  configureAmplify();
  await signOut();
};
