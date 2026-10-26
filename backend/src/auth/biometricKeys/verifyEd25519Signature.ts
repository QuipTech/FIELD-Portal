import { createPublicKey, verify } from 'crypto';

export const ED25519_PUBLIC_KEY_BYTES = 32;
const ED25519_SIGNATURE_BYTES = 64;
// Ties a signature to biometric sign-in, so it can't be reused elsewhere.
const SIGNED_MESSAGE_PREFIX = 'field-biometric-v1';

// What the phone signs: the challenge exactly as the server sent it (base64).
export const buildBiometricSignedMessage = (
  challengeId: string,
  challenge: string,
) => `${SIGNED_MESSAGE_PREFIX}:${challengeId}:${challenge}`;

export const verifyEd25519Signature = (
  storedPublicKey: Uint8Array,
  message: string,
  signatureBase64: string,
): boolean => {
  // pg returns bytea as a Buffer; other drivers as a plain Uint8Array.
  const publicKey = Buffer.from(storedPublicKey);
  const signature = Buffer.from(signatureBase64, 'base64');
  if (
    publicKey.length !== ED25519_PUBLIC_KEY_BYTES ||
    signature.length !== ED25519_SIGNATURE_BYTES
  )
    return false;
  try {
    const key = createPublicKey({
      key: { kty: 'OKP', crv: 'Ed25519', x: publicKey.toString('base64url') },
      format: 'jwk',
    });
    return verify(null, Buffer.from(message, 'utf8'), key, signature);
  } catch {
    return false;
  }
};
