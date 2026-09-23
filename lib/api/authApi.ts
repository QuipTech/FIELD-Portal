import { apiRequest } from "./httpClient";
import type { AuthSession } from "../types/authSession";

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

export const logoutRequest = (refreshToken: string): Promise<void> =>
  apiRequest<void>("/auth/logout", {
    method: "POST",
    body: JSON.stringify({ refreshToken }),
  });
