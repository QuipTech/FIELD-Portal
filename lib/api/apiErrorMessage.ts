import { ApiError } from "./httpClient";

const SESSION_EXPIRED_MESSAGE = "Your session has expired. Sign in again.";
const ROUTE_MISSING_MESSAGE = "This isn't available on the server yet. Please try again later.";

// Express's own 404 for a route the backend doesn't have ("Cannot GET /…").
const isMissingRoute = (error: ApiError) => error.status === 404 && /^Cannot [A-Z]+ \//.test(error.message);

// A 401 means the stored access token is missing or expired, which the
// backend reports as a bare "Unauthorized" — reword it for people.
export const toApiErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof ApiError && error.status === 401) return SESSION_EXPIRED_MESSAGE;
  if (error instanceof ApiError && isMissingRoute(error)) return ROUTE_MISSING_MESSAGE;
  return error instanceof ApiError ? error.message : fallback;
};
