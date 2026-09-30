// Cognito only checks a reset code together with the new password, so the
// code entered on /forgot-password/verify waits here for the next step
// (kept out of the URL and browser history). Cleared once used.
const PASSWORD_RESET_CODE_KEY = "qt_password_reset_code";

export const savePasswordResetCode = (code: string): void => {
  try {
    sessionStorage.setItem(PASSWORD_RESET_CODE_KEY, code);
  } catch {
    // Storage blocked: the reset page sends them back for the code.
  }
};

export const readPasswordResetCode = (): string | null => {
  try {
    return sessionStorage.getItem(PASSWORD_RESET_CODE_KEY);
  } catch {
    return null;
  }
};

export const clearPasswordResetCode = (): void => {
  try {
    sessionStorage.removeItem(PASSWORD_RESET_CODE_KEY);
  } catch {
    // Nothing to clear.
  }
};
