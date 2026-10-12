import type { SignupProfile } from "../types/authSession";

// Company name and phone number aren't Cognito attributes, so the register
// form keeps them here until the email is verified and /auth/callback
// creates the account with them. If they're lost (other browser, cleared
// storage), the callback falls back to asking in the signup profile dialog.
const PENDING_SIGNUP_PROFILE_KEY = "qt_pending_signup_profile";

interface PendingSignupProfile extends SignupProfile {
  email: string;
}

const normaliseEmail = (email: string) => email.trim().toLowerCase();

export const savePendingSignupProfile = (email: string, profile: SignupProfile): void => {
  try {
    const pending: PendingSignupProfile = { email: normaliseEmail(email), ...profile };
    localStorage.setItem(PENDING_SIGNUP_PROFILE_KEY, JSON.stringify(pending));
  } catch {
    // Storage blocked: the signup profile dialog asks instead.
  }
};

// Only returned for the account it was saved for.
export const readPendingSignupProfile = (email: string): SignupProfile | undefined => {
  try {
    const stored = localStorage.getItem(PENDING_SIGNUP_PROFILE_KEY);
    if (!stored) return undefined;
    const { email: savedEmail, companyName, phoneNumber } = JSON.parse(stored) as PendingSignupProfile;
    return savedEmail === normaliseEmail(email) ? { companyName, phoneNumber } : undefined;
  } catch {
    return undefined;
  }
};

export const clearPendingSignupProfile = (): void => {
  try {
    localStorage.removeItem(PENDING_SIGNUP_PROFILE_KEY);
  } catch {
    // Nothing to clear.
  }
};
