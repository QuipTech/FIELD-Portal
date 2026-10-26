import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { generateKeyPairSync, sign, type KeyObject } from 'crypto';
import { createKnowledgeTestDatabase } from '../knowledgeBrands/knowledgeTestDatabase';
import { AuthTokenService } from '../../src/auth/authToken.service';
import { StorageService } from '../../src/storage/storage.service';
import { BiometricKeyRegistrationService } from '../../src/auth/biometricKeys/biometricKeyRegistration.service';
import { BiometricSignInService } from '../../src/auth/biometricKeys/biometricSignIn.service';

type TestDatabase = Awaited<ReturnType<typeof createKnowledgeTestDatabase>>;
const IP = '203.0.113.7';

// A phone's key pair, as the app makes it with @noble/curves.
const createPhoneKey = () => {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const raw = Buffer.from(
    publicKey.export({ format: 'jwk' }).x as string,
    'base64url',
  );
  return { publicKey: raw.toString('base64'), privateKey };
};
const signChallenge = (
  privateKey: KeyObject,
  challengeId: string,
  challenge: string,
) =>
  sign(
    null,
    Buffer.from(`field-biometric-v1:${challengeId}:${challenge}`),
    privateKey,
  ).toString('base64');

describe('Mobile biometric (Ed25519 device key) sign-in', () => {
  let fixture: TestDatabase;
  let registration: BiometricKeyRegistrationService;
  let signIn: BiometricSignInService;

  beforeAll(async () => {
    fixture = await createKnowledgeTestDatabase();
    const config = new ConfigService({
      JWT_SECRET: 'test-access-secret',
      JWT_REFRESH_SECRET: 'test-refresh-secret',
    });
    registration = new BiometricKeyRegistrationService(fixture.database);
    signIn = new BiometricSignInService(
      fixture.database,
      new AuthTokenService(new JwtService(), config),
      {} as StorageService,
    );
  });
  afterAll(() => fixture.db.close());
  beforeEach(() => fixture.db.exec('BEGIN'));
  afterEach(() => fixture.db.exec('ROLLBACK'));

  const enrol = async (person = fixture.actor) => {
    const phone = createPhoneKey();
    const saved = await registration.register(
      person,
      {
        algorithm: 'ed25519',
        publicKey: phone.publicKey,
        deviceType: 'ios',
        appVersion: '1.0.0',
      },
      IP,
    );
    return { phone, keyId: saved.id };
  };
  const signInWith = async (keyId: string, privateKey: KeyObject) => {
    const { challengeId, challenge } = await signIn.startSignIn({ keyId });
    const signature = signChallenge(privateKey, challengeId, challenge);
    return signIn.finishSignIn({ keyId, challengeId, signature }, IP);
  };

  it('turns it on, then signs in with the /auth/sync response shape', async () => {
    const { phone, keyId } = await enrol();
    const result = await signInWith(keyId, phone.privateKey);
    expect(result.status).toBe('signedIn');
    if (result.status !== 'signedIn') return;
    expect(result.session.user.id).toBe(fixture.actor.userId);
    expect(result.session.tenant.id).toBe(fixture.actor.tenantId);
    expect(result.session.refreshToken).toEqual(expect.any(String));
    const [listed] = await registration.list(fixture.actor);
    expect(listed).toMatchObject({
      id: keyId,
      deviceType: 'ios',
      appVersion: '1.0.0',
    });
    expect(listed.lastUsedAt).not.toBeNull();
  });

  it('accepts each challenge once, and only for the key it was issued to', async () => {
    const { phone, keyId } = await enrol();
    const { challengeId, challenge } = await signIn.startSignIn({ keyId });
    const signature = signChallenge(phone.privateKey, challengeId, challenge);
    await signIn.finishSignIn({ keyId, challengeId, signature }, IP);
    await expect(
      signIn.finishSignIn({ keyId, challengeId, signature }, IP),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    const other = await enrol();
    const issued = await signIn.startSignIn({ keyId });
    await expect(
      signIn.finishSignIn(
        {
          keyId: other.keyId,
          challengeId: issued.challengeId,
          signature: signChallenge(
            other.phone.privateKey,
            issued.challengeId,
            issued.challenge,
          ),
        },
        IP,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('revokes the key after five bad signatures in a row', async () => {
    const { keyId } = await enrol();
    const stranger = createPhoneKey();
    for (let attempt = 0; attempt < 5; attempt += 1)
      await expect(
        signInWith(keyId, stranger.privateKey),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(signIn.startSignIn({ keyId })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(await registration.list(fixture.actor)).toEqual([]);
  });

  it("keeps each user's phones private, and stops working once removed", async () => {
    const { phone, keyId } = await enrol();
    expect(
      (await registration.list(fixture.admin)).map((key) => key.id),
    ).not.toContain(keyId);
    await expect(
      registration.remove(fixture.admin, keyId, IP),
    ).rejects.toBeInstanceOf(NotFoundException);
    await registration.remove(fixture.actor, keyId, IP);
    await expect(signInWith(keyId, phone.privateKey)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('refuses a disabled account', async () => {
    const { keyId } = await enrol();
    await fixture.db.query("UPDATE users SET status='disabled' WHERE id=$1", [
      fixture.actor.userId,
    ]);
    await expect(signIn.startSignIn({ keyId })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects a public key that is not 32 bytes', async () => {
    await expect(
      registration.register(
        fixture.actor,
        {
          algorithm: 'ed25519',
          publicKey: Buffer.alloc(31).toString('base64'),
          deviceType: 'android',
        },
        IP,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('keeps at most ten phones, dropping the oldest', async () => {
    const first = await enrol();
    await fixture.db.query(
      "UPDATE biometric_keys SET created_at = now() - interval '1 day' WHERE id=$1",
      [first.keyId],
    );
    for (let phone = 0; phone < 10; phone += 1) await enrol();
    const listed = await registration.list(fixture.actor);
    expect(listed).toHaveLength(10);
    expect(listed.map((key) => key.id)).not.toContain(first.keyId);
  });
});
