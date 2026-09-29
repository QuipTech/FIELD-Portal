export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResponse extends AuthTokens {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    // Role names, e.g. ["Owner"] — the portal picks the admin or customer
    // dashboard from these after sign-in.
    roles: string[];
    // Permission codes granted by those roles, e.g. "ai.use"; the portal
    // disables actions the user lacks.
    permissions: string[];
  };
  tenant: {
    id: string;
    name: string;
    slug: string;
  };
}
