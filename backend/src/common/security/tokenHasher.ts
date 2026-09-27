import { createHash } from 'crypto';

// Refresh tokens are already high-entropy signed JWTs, not user-chosen
// secrets, so a fast SHA-256 digest is appropriate here — bcrypt's
// deliberate slowness is for password guessing, which doesn't apply to a
// token nobody can brute-force offline in the first place.
export const hashToken = (rawToken: string): string =>
  createHash('sha256').update(rawToken).digest('hex');
