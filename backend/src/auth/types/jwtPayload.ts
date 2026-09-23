export interface AccessTokenPayload {
  sub: string;
  tenantId: string;
  email: string;
}

export interface RefreshTokenPayload {
  sub: string;
  tenantId: string;
  userId: string;
  // Guarantees each issuance is unique even if signed within the same
  // second as the previous one for this session, so rotating a session
  // always invalidates the token it replaces.
  jti: string;
}
