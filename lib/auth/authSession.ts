import type {
  AuthSession,
  AuthSessionTenant,
  AuthSessionUser,
  SignedInProfile,
  SignInMethod,
} from "../types/authSession";

const ACCESS_TOKEN_KEY = "field.accessToken";
const REFRESH_TOKEN_KEY = "field.refreshToken";
const USER_KEY = "field.user";
const TENANT_KEY = "field.tenant";
const SIGN_IN_METHOD_KEY = "field.signInMethod";

const isBrowser = () => typeof window !== "undefined";

export const saveAuthSession = (
  session: AuthSession,
  signInMethod: SignInMethod = "password",
): void => {
  if (!isBrowser()) return;
  window.localStorage.setItem(ACCESS_TOKEN_KEY, session.accessToken);
  window.localStorage.setItem(REFRESH_TOKEN_KEY, session.refreshToken);
  window.localStorage.setItem(USER_KEY, JSON.stringify(session.user));
  window.localStorage.setItem(TENANT_KEY, JSON.stringify(session.tenant));
  window.localStorage.setItem(SIGN_IN_METHOD_KEY, signInMethod);
};

export const getAccessToken = (): string | null =>
  isBrowser() ? window.localStorage.getItem(ACCESS_TOKEN_KEY) : null;

export const getRefreshToken = (): string | null =>
  isBrowser() ? window.localStorage.getItem(REFRESH_TOKEN_KEY) : null;

// Replaces only the stored user, e.g. after re-reading roles/permissions.
export const saveStoredUser = (user: AuthSessionUser): void => {
  if (!isBrowser()) return;
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
};

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

export const getStoredProfile = (): SignedInProfile | null => {
  const user = getStoredUser();
  if (!user) return null;
  const storedMethod = window.localStorage.getItem(SIGN_IN_METHOD_KEY);
  return {
    user,
    tenant: getStoredTenant(),
    signInMethod: (storedMethod === "federated" ? storedMethod : "password") satisfies SignInMethod,
  };
};

export const clearAuthSession = (): void => {
  if (!isBrowser()) return;
  [ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY, TENANT_KEY, SIGN_IN_METHOD_KEY].forEach((key) =>
    window.localStorage.removeItem(key),
  );
};
