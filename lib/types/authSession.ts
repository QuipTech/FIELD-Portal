export interface AuthSessionUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface AuthSessionTenant {
  id: string;
  name: string;
  slug: string;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: AuthSessionUser;
  tenant: AuthSessionTenant;
}
