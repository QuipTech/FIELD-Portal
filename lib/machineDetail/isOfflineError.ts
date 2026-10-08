import { ApiError } from "@/lib/api/httpClient";

// True when a request failed because the device has no connection: the
// browser says it's offline, fetch threw before a response (TypeError),
// or the upload XHR reported a network error (ApiError status 0).
export const isOfflineError = (error: unknown): boolean =>
  (typeof navigator !== "undefined" && !navigator.onLine) ||
  error instanceof TypeError ||
  (error instanceof ApiError && error.status === 0);
