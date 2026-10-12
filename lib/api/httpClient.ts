import { refreshAccessToken } from "../auth/refreshAccessToken";
import { API_BASE_URL, CLIENT_HEADERS } from "./apiConnection";

export { API_BASE_URL, CLIENT_HEADERS };

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export const extractErrorMessage = (body: unknown): string => {
  const message = (body as { message?: string | string[] } | null)?.message;
  if (Array.isArray(message)) return message[0];
  return message ?? "Something went wrong. Please try again.";
};

// /auth/sync is authorised with a Cognito ID token, not a FIELD session.
const COGNITO_AUTHORISED_PATH = "/auth/sync";

// Sends the request; if a FIELD access token was rejected (it expires
// after 15 minutes), refreshes the session and sends it once more.
const fetchWithSessionRefresh = async (path: string, init: RequestInit): Promise<Response> => {
  const response = await fetch(`${API_BASE_URL}${path}`, init);
  const headers = new Headers(init.headers);
  if (response.status !== 401 || !headers.has("Authorization") || path === COGNITO_AUTHORISED_PATH) return response;
  const accessToken = await refreshAccessToken();
  if (!accessToken) return response;
  headers.set("Authorization", `Bearer ${accessToken}`);
  return fetch(`${API_BASE_URL}${path}`, { ...init, headers });
};

export const apiRequest = async <TResponse>(path: string, options: RequestInit = {}): Promise<TResponse> => {
  const response = await fetchWithSessionRefresh(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...CLIENT_HEADERS, ...options.headers },
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(extractErrorMessage(body), response.status);
  }

  return body as TResponse;
};

// For endpoints that return a file rather than JSON (e.g. CSV exports).
export const apiDownloadRequest = async (
  path: string,
  options: RequestInit = {},
): Promise<{ blob: Blob; headers: Headers }> => {
  const response = await fetchWithSessionRefresh(path, {
    ...options,
    headers: { ...CLIENT_HEADERS, ...options.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(extractErrorMessage(body), response.status);
  }
  return { blob: await response.blob(), headers: response.headers };
};
