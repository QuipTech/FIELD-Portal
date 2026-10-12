import { apiRequest } from "./httpClient";
import type { AuthSession, AuthSessionUser, CognitoSyncResponse, SignupProfile } from "../types/authSession";

// Exchanges a Cognito ID token (any sign-in: email/password, Google, Apple)
// for a FIELD session. A first-time user without a signup profile gets
// `profileRequired` and must call again with company name + phone number.
export const syncCognitoSessionRequest = (
  cognitoIdToken: string,
  signupProfile?: SignupProfile,
): Promise<CognitoSyncResponse> =>
  apiRequest<CognitoSyncResponse>("/auth/sync", {
    method: "POST",
    headers: { Authorization: `Bearer ${cognitoIdToken}` },
    body: JSON.stringify(signupProfile ?? {}),
  });

export type PasswordResetEligibility =
  | { status: "eligible" }
  | { status: "notFound" }
  | { status: "federatedOnly"; provider: "google" | "apple" }
  | { status: "unverified" };

// Whether a password login exists for this email, before Cognito is asked
// to send a reset code.
export const checkPasswordResetRequest = (email: string): Promise<PasswordResetEligibility> =>
  apiRequest<PasswordResetEligibility>("/auth/password-reset/check", {
    method: "POST",
    body: JSON.stringify({ email }),
  });

export interface CurrentUserResponse extends AuthSessionUser {
  status: string;
  permissions: string[];
}

// Re-reads the signed-in user, including their current roles/permissions.
export const fetchCurrentUserRequest = (accessToken: string): Promise<CurrentUserResponse> =>
  apiRequest<CurrentUserResponse>("/auth/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

export const logoutRequest = (refreshToken: string): Promise<void> =>
  apiRequest<void>("/auth/logout", {
    method: "POST",
    body: JSON.stringify({ refreshToken }),
  });
