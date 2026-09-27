// Diagnostics for the Google/Apple sign-in flow: shows in the browser
// console exactly what Cognito put in the ID token and what the backend
// answered. Only decoded claims are logged — never the raw token, which
// would be a usable credential in anyone's copied console output.
const AUTH_DEBUG_PREFIX = "[FIELD auth]";

export const logAuthDebug = (message: string, details?: unknown): void => {
  // eslint-disable-next-line no-console -- intentional sign-in diagnostics
  console.info(AUTH_DEBUG_PREFIX, message, details ?? "");
};
