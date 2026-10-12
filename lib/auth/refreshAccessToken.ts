import { API_BASE_URL, CLIENT_HEADERS } from "../api/apiConnection";
import type { AuthSession } from "../types/authSession";
import { getAccessToken, getRefreshToken, getStoredSignInMethod, saveAuthSession } from "./authSession";

let pendingRefresh: Promise<string | null> | null = null;

const requestRefreshedSession = async (refreshToken: string): Promise<AuthSession | null> => {
  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...CLIENT_HEADERS },
    body: JSON.stringify({ refreshToken }),
  });
  return response.ok ? ((await response.json()) as AuthSession) : null;
};

const renewSession = async (): Promise<string | null> => {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;
  const session = await requestRefreshedSession(refreshToken).catch(() => null);
  if (session) {
    saveAuthSession(session, getStoredSignInMethod());
    return session.accessToken;
  }
  // Another tab may have rotated the refresh token first; use what it saved.
  return getRefreshToken() !== refreshToken ? getAccessToken() : null;
};

// Access tokens last 15 minutes; the 30-day refresh token swaps one for a
// new pair. Every refresh rotates the refresh token, so concurrent 401s
// share one request — a second refresh with the old token would fail.
// Resolves to the new access token, or null when the session is over.
export const refreshAccessToken = (): Promise<string | null> => {
  pendingRefresh ??= renewSession().finally(() => {
    pendingRefresh = null;
  });
  return pendingRefresh;
};
