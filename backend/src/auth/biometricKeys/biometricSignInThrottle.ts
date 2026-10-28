// Per client IP, on the two signed-out biometric routes. Counters live in
// this API instance's memory, so with several instances the limit applies
// per instance. A key is also revoked after 5 bad signatures in a row
// (biometric_record_failure, migration 0111).
export const BIOMETRIC_SIGN_IN_THROTTLER = {
  name: 'biometricSignIn',
  ttl: 60 * 1000,
  limit: 10,
};
