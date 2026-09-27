import { apiRequest } from "./httpClient";
import type { AuthSession, AuthSessionUser, CognitoSyncResponse, SignupProfile } from "../types/authSession";

export interface RegisterPayload {
  firstName: string;
  lastName: string;
  companyName: string;
  email: string;
  phoneNumber?: string;
  password: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export const registerRequest = (payload: RegisterPayload): Promise<AuthSession> =>
  apiRequest<AuthSession>("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const loginRequest = (payload: LoginPayload): Promise<AuthSession> =>
  apiRequest<AuthSession>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });

// Exchanges a Cognito ID token (Google/Apple sign-in) for a regular FIELD
// session. A first-time user gets `profileRequired` and must call again
// with their signup profile (company name + phone number).
export const syncCognitoSessionRequest = (
  cognitoIdToken: string,
  signupProfile?: SignupProfile,
): Promise<CognitoSyncResponse> =>
  apiRequest<CognitoSyncResponse>("/auth/sync", {
    method: "POST",
    headers: { Authorization: `Bearer ${cognitoIdToken}` },
    body: JSON.stringify(signupProfile ?? {}),
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
