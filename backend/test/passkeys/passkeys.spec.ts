import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createKnowledgeTestDatabase } from '../knowledgeBrands/knowledgeTestDatabase';
import { AuthTokenService } from '../../src/auth/authToken.service';
import { StorageService } from '../../src/storage/storage.service';
import { PasskeyRegistrationService } from '../../src/auth/passkeys/passkeyRegistration.service';
import { PasskeySignInService } from '../../src/auth/passkeys/passkeySignIn.service';
import { createSoftwareAuthenticator } from './softwareAuthenticator';

const ORIGIN = 'http://localhost:3001';
type TestDatabase = Awaited<ReturnType<typeof createKnowledgeTestDatabase>>;

describe('Passkey (Face ID / Touch ID) sign-in', () => {
  let fixture: TestDatabase;
  let registration: PasskeyRegistrationService;
  let signIn: PasskeySignInService;

  beforeAll(async () => {
    process.env.PORTAL_ORIGIN = ORIGIN;
    fixture = await createKnowledgeTestDatabase();
    const config = new ConfigService({
      JWT_SECRET: 'test-access-secret',
      JWT_REFRESH_SECRET: 'test-refresh-secret',
    });
    registration = new PasskeyRegistrationService(fixture.database);
    signIn = new PasskeySignInService(
      fixture.database,
      new AuthTokenService(new JwtService(), config),
      {} as StorageService,
    );
  });
  afterAll(() => fixture.db.close());
  // Each test runs in a transaction that is rolled back, like the knowledge specs.
  beforeEach(() => fixture.db.exec('BEGIN'));
  afterEach(() => fixture.db.exec('ROLLBACK'));

  const enrol = async (device = createSoftwareAuthenticator(ORIGIN)) => {
    const { challengeId, options } = await registration.startRegistration(fixture.actor);
    const saved = await registration.finishRegistration(fixture.actor, {
      challengeId,
      response: device.register(options),
      deviceName: 'Test MacBook',
    });
    return { device, saved };
  };
  const signInWith = async (device: ReturnType<typeof createSoftwareAuthenticator>) => {
    const { challengeId, options } = await signIn.startSignIn();
    return signIn.finishSignIn({ challengeId, response: device.authenticate(options) });
  };

  it('enrols this device, then signs in to that account with no email or password', async () => {
    const { device, saved } = await enrol();
    expect(saved.deviceName).toBe('Test MacBook');
    const session = await signInWith(device);
    expect(session.user.id).toBe(fixture.actor.userId);
    expect(session.tenant.id).toBe(fixture.actor.tenantId);
    expect(session.accessToken).toEqual(expect.any(String));
    const [listed] = await registration.list(fixture.actor);
    expect(listed.lastUsedAt).not.toBeNull();
  });

  it('accepts each challenge once, and only for its own purpose', async () => {
    const { device } = await enrol();
    const { challengeId, options } = await signIn.startSignIn();
    const response = device.authenticate(options);
    await signIn.finishSignIn({ challengeId, response });
    await expect(signIn.finishSignIn({ challengeId, response })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    const enrolment = await registration.startRegistration(fixture.actor);
    await expect(
      signIn.finishSignIn({ challengeId: enrolment.challengeId, response }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a device that was never enrolled', async () => {
    await expect(signInWith(createSoftwareAuthenticator(ORIGIN))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a signature made for another site', async () => {
    const { device } = await enrol();
    const { challengeId, options } = await signIn.startSignIn();
    // The enrolled key signs, but a look-alike site's origin must still fail.
    const response = device.authenticate(options);
    const clientData = JSON.parse(
      Buffer.from(response.response.clientDataJSON, 'base64url').toString(),
    );
    clientData.origin = 'https://evil.example';
    response.response.clientDataJSON = Buffer.from(JSON.stringify(clientData)).toString('base64url');
    await expect(signIn.finishSignIn({ challengeId, response })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("won't enrol with another user's challenge", async () => {
    const { challengeId, options } = await registration.startRegistration(fixture.admin);
    await expect(
      registration.finishRegistration(fixture.actor, {
        challengeId,
        response: createSoftwareAuthenticator(ORIGIN).register(options),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("keeps each user's passkeys private to them", async () => {
    const { saved } = await enrol();
    expect((await registration.list(fixture.admin)).map((key) => key.id)).not.toContain(saved.id);
    await expect(registration.remove(fixture.admin, saved.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('stops working once removed, and for a disabled account', async () => {
    const removed = await enrol();
    await registration.remove(fixture.actor, removed.saved.id);
    await expect(signInWith(removed.device)).rejects.toBeInstanceOf(UnauthorizedException);

    const kept = await enrol();
    await fixture.db.query("UPDATE users SET status='disabled' WHERE id=$1", [fixture.actor.userId]);
    await expect(signInWith(kept.device)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
