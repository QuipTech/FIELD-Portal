import {
  AuthError,
  autoSignIn,
  confirmResetPassword,
  confirmSignIn,
  confirmSignUp,
  resendSignUpCode,
  resetPassword,
  signIn,
  signOut,
  signUp,
} from "aws-amplify/auth";
import { configureAmplify } from "./amplifyConfig";

// Email/password accounts live in the Cognito user pool, which also sends
// the verification and password-reset codes. After any sign-in here the
// portal goes to /auth/callback, which exchanges the Cognito ID token for
// a FIELD session exactly as it does for Google/Apple.

// newPasswordRequired: an invited user signing in with the temporary
// password Cognito emailed them; they choose their own on /set-password.
export type PasswordSignInOutcome = "signedIn" | "emailNotVerified" | "newPasswordRequired";

const USER_ALREADY_AUTHENTICATED = "UserAlreadyAuthenticatedException";

// A sign-in Cognito accepted but that needs a step the portal can't do;
// its message is written for the user.
export class UnsupportedSignInStepError extends Error {}

const COGNITO_ERROR_MESSAGES: Record<string, string> = {
  UsernameExistsException: "An account with this email already exists. Sign in instead.",
  NotAuthorizedException: "Invalid email or password.",
  UserNotFoundException: "Invalid email or password.",
  CodeMismatchException: "That code isn't right. Check the email and try again.",
  ExpiredCodeException: "This code has expired. Request a new one.",
  LimitExceededException: "Too many attempts. Please wait a few minutes and try again.",
  TooManyRequestsException: "Too many attempts. Please wait a few minutes and try again.",
  TooManyFailedAttemptsException: "Too many attempts. Please wait a few minutes and try again.",
  CodeDeliveryFailureException: "We couldn't send the email. Check the address and try again.",
};

// Cognito's own wording for password policy failures is fine to show once
// its "Password did not conform with policy:" prefix is dropped.
const describePasswordPolicyError = (message: string) =>
  message.replace(/^Password did not conform with policy:\s*/i, "");

// What someone an admin removed sees: the API disables their sign-in, so
// Cognito answers "User is disabled." (matches the API's own wording).
export const ACCOUNT_REMOVED_MESSAGE =
  "An administrator removed your FIELD account. Contact your administrator if you think this is a mistake.";

export const isDisabledSignInMessage = (message: string | undefined): boolean => /user is disabled/i.test(message ?? "");

export const toCognitoErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof UnsupportedSignInStepError) return error.message;
  if (!(error instanceof AuthError)) return fallback;
  if (error.name === "NotAuthorizedException" && isDisabledSignInMessage(error.message)) return ACCOUNT_REMOVED_MESSAGE;
  if (error.name === "InvalidPasswordException") return describePasswordPolicyError(error.message);
  if (error.name === "InvalidParameterException" && /password/i.test(error.message)) {
    return describePasswordPolicyError(error.message);
  }
  return COGNITO_ERROR_MESSAGES[error.name] ?? fallback;
};

export const signUpWithEmail = async (params: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}): Promise<void> => {
  configureAmplify();
  await signUp({
    username: params.email,
    password: params.password,
    options: {
      userAttributes: {
        email: params.email,
        given_name: params.firstName,
        family_name: params.lastName,
      },
      // Lets confirmEmailCode sign straight in without asking for the
      // password again (only within this page session).
      autoSignIn: true,
    },
  });
};

// true = verified and signed in; false = verified, but the user must sign
// in themselves (e.g. the page was reloaded since sign-up).
export const confirmEmailCode = async (email: string, code: string): Promise<boolean> => {
  configureAmplify();
  const { nextStep } = await confirmSignUp({ username: email, confirmationCode: code });
  if (nextStep.signUpStep !== "COMPLETE_AUTO_SIGN_IN") return false;
  try {
    const { isSignedIn } = await autoSignIn();
    return isSignedIn;
  } catch {
    return false;
  }
};

export const resendEmailCode = async (email: string): Promise<void> => {
  configureAmplify();
  await resendSignUpCode({ username: email });
};

export const signInWithEmail = async (email: string, password: string): Promise<PasswordSignInOutcome> => {
  configureAmplify();
  const attempt = () => signIn({ username: email, password });
  let result: Awaited<ReturnType<typeof signIn>>;
  try {
    result = await attempt();
  } catch (error) {
    // A Cognito session left behind by an earlier sign-in (possibly
    // another person's): drop it and sign in fresh.
    if (!(error instanceof AuthError) || error.name !== USER_ALREADY_AUTHENTICATED) throw error;
    await signOut();
    result = await attempt();
  }

  if (result.isSignedIn) return "signedIn";
  if (result.nextStep.signInStep === "CONFIRM_SIGN_UP") return "emailNotVerified";
  if (result.nextStep.signInStep === "CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED") return "newPasswordRequired";
  if (result.nextStep.signInStep === "RESET_PASSWORD") {
    throw new UnsupportedSignInStepError("You need to reset your password. Use “Forgot password” below.");
  }
  // MFA and other challenges aren't turned on for the portal's app client.
  throw new UnsupportedSignInStepError("This sign-in needs a step the portal doesn't support yet. Please contact support.");
};

// Finishes an invited user's first sign-in with the password they chose.
// Only works in the same page session as signInWithEmail (Amplify keeps the
// pending challenge in memory); true once signed in.
export const completeFirstSignIn = async (newPassword: string): Promise<boolean> => {
  configureAmplify();
  const { isSignedIn } = await confirmSignIn({ challengeResponse: newPassword });
  return isSignedIn;
};

export const requestPasswordReset = async (email: string): Promise<void> => {
  configureAmplify();
  await resetPassword({ username: email });
};

export const completePasswordReset = async (params: {
  email: string;
  code: string;
  newPassword: string;
}): Promise<void> => {
  configureAmplify();
  await confirmResetPassword({
    username: params.email,
    confirmationCode: params.code,
    newPassword: params.newPassword,
  });
};
