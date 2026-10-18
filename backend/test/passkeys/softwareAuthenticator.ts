import { createHash, generateKeyPairSync, randomBytes, sign } from 'crypto';
import { isoBase64URL, isoCBOR } from '@simplewebauthn/server/helpers';
import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/server';

// A stand-in for Touch ID / Face ID in tests: a real P-256 key pair that
// answers WebAuthn challenges the way a platform authenticator does, so the
// server-side checks run for real.
const FLAG_USER_PRESENT = 0x01;
const FLAG_USER_VERIFIED = 0x04;
const FLAG_ATTESTED_CREDENTIAL = 0x40;

const sha256 = (data: Buffer | string) => createHash('sha256').update(data).digest();
const toB64 = (data: Uint8Array) => isoBase64URL.fromBuffer(new Uint8Array(data));
const counterBytes = (count: number) => {
  const bytes = Buffer.alloc(4);
  bytes.writeUInt32BE(count);
  return bytes;
};

export const createSoftwareAuthenticator = (origin: string) => {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const jwk = publicKey.export({ format: 'jwk' });
  const credentialId = randomBytes(32);
  let signCount = 0;
  let userHandle = '';

  const clientData = (type: string, challenge: string) =>
    Buffer.from(JSON.stringify({ type, challenge, origin, crossOrigin: false }));

  const register = (
    options: PublicKeyCredentialCreationOptionsJSON,
  ): RegistrationResponseJSON => {
    userHandle = options.user.id;
    const cosePublicKey = isoCBOR.encode(
      new Map<number, number | Uint8Array>([
        [1, 2],
        [3, -7],
        [-1, 1],
        [-2, new Uint8Array(Buffer.from(jwk.x!, 'base64url'))],
        [-3, new Uint8Array(Buffer.from(jwk.y!, 'base64url'))],
      ]),
    );
    const idLength = Buffer.alloc(2);
    idLength.writeUInt16BE(credentialId.length);
    const authData = Buffer.concat([
      sha256(options.rp.id!),
      Buffer.from([FLAG_USER_PRESENT | FLAG_USER_VERIFIED | FLAG_ATTESTED_CREDENTIAL]),
      counterBytes(signCount),
      Buffer.alloc(16),
      idLength,
      credentialId,
      Buffer.from(cosePublicKey),
    ]);
    const attestationObject = isoCBOR.encode(
      new Map<string, string | Uint8Array | Map<string, never>>([
        ['fmt', 'none'],
        ['attStmt', new Map<string, never>()],
        ['authData', new Uint8Array(authData)],
      ]),
    );
    return {
      id: toB64(credentialId),
      rawId: toB64(credentialId),
      type: 'public-key',
      clientExtensionResults: {},
      response: {
        clientDataJSON: toB64(clientData('webauthn.create', options.challenge)),
        attestationObject: toB64(attestationObject),
        transports: ['internal'],
      },
    };
  };

  const authenticate = (
    options: PublicKeyCredentialRequestOptionsJSON,
  ): AuthenticationResponseJSON => {
    signCount += 1;
    const authData = Buffer.concat([
      sha256(options.rpId!),
      Buffer.from([FLAG_USER_PRESENT | FLAG_USER_VERIFIED]),
      counterBytes(signCount),
    ]);
    const clientDataJSON = clientData('webauthn.get', options.challenge);
    const signature = sign('sha256', Buffer.concat([authData, sha256(clientDataJSON)]), privateKey);
    return {
      id: toB64(credentialId),
      rawId: toB64(credentialId),
      type: 'public-key',
      clientExtensionResults: {},
      response: {
        authenticatorData: toB64(authData),
        clientDataJSON: toB64(clientDataJSON),
        signature: toB64(signature),
        userHandle,
      },
    };
  };

  return { register, authenticate };
};
