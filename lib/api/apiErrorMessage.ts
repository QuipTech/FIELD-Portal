import { ApiError } from "./httpClient";

const SESSION_EXPIRED_MESSAGE = "Your session has expired. Sign in again.";

// A 401 means the stored access token is missing or expired, which the
// backend reports as a bare "Unauthorized" — reword it for people.
export const toApiErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof ApiError && error.status === 401) return SESSION_EXPIRED_MESSAGE;
  return error instanceof ApiError ? error.message : fallback;
};
