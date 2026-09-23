import type { AuthSession, AuthSessionTenant, AuthSessionUser } from "../types/authSession";

const ACCESS_TOKEN_KEY = "field.accessToken";
const REFRESH_TOKEN_KEY = "field.refreshToken";
const USER_KEY = "field.user";
const TENANT_KEY = "field.tenant";

const isBrowser = () => typeof window !== "undefined";

export const saveAuthSession = (session: AuthSession): void => {
  if (!isBrowser()) return;
  window.localStorage.setItem(ACCESS_TOKEN_KEY, session.accessToken);
  window.localStorage.setItem(REFRESH_TOKEN_KEY, session.refreshToken);
  window.localStorage.setItem(USER_KEY, JSON.stringify(session.user));
  window.localStorage.setItem(TENANT_KEY, JSON.stringify(session.tenant));
};

export const getAccessToken = (): string | null =>
  isBrowser() ? window.localStorage.getItem(ACCESS_TOKEN_KEY) : null;

export const getRefreshToken = (): string | null =>
  isBrowser() ? window.localStorage.getItem(REFRESH_TOKEN_KEY) : null;

export const getStoredUser = (): AuthSessionUser | null => {
  if (!isBrowser()) return null;
  const raw = window.localStorage.getItem(USER_KEY);
  return raw ? (JSON.parse(raw) as AuthSessionUser) : null;
};

export const getStoredTenant = (): AuthSessionTenant | null => {
  if (!isBrowser()) return null;
  const raw = window.localStorage.getItem(TENANT_KEY);
  return raw ? (JSON.parse(raw) as AuthSessionTenant) : null;
};

export const clearAuthSession = (): void => {
  if (!isBrowser()) return;
  [ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY, TENANT_KEY].forEach((key) =>
    window.localStorage.removeItem(key),
  );
};
