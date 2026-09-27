import { UnauthorizedException } from '@nestjs/common';
import { CognitoIdTokenPayload } from 'aws-jwt-verify/jwt-model';
import { mapCognitoIdentity } from './mapCognitoIdentity';

const buildPayload = (claims: Record<string, unknown>) =>
  ({
    sub: 'sub-123',
    email: 'tech@quiptech.com',
    ...claims,
  }) as unknown as CognitoIdTokenPayload;

describe('mapCognitoIdentity', () => {
  it('maps a Google identity with a string email_verified claim', () => {
    const identity = mapCognitoIdentity(
      buildPayload({
        email_verified: 'true',
        identities: [{ providerName: 'Google' }],
      }),
    );
    expect(identity).toEqual({
      cognitoSub: 'sub-123',
      email: 'tech@quiptech.com',
      emailVerified: true,
      authProvider: 'google',
      firstName: 'tech',
      lastName: '',
      pictureUrl: null,
    });
  });

  it('keeps an https picture claim as the profile photo', () => {
    const picture = 'https://lh3.googleusercontent.com/a/photo=s96-c';
    const identity = mapCognitoIdentity(buildPayload({ picture }));
    expect(identity.pictureUrl).toBe(picture);
  });

  it('drops a picture claim that is not an https URL', () => {
    for (const picture of [
      'http://example.com/p.png',
      'javascript:alert(1)',
      'not a url',
    ]) {
      expect(
        mapCognitoIdentity(buildPayload({ picture })).pictureUrl,
      ).toBeNull();
    }
  });

  it('maps SignInWithApple to apple', () => {
    const identity = mapCognitoIdentity(
      buildPayload({ identities: [{ providerName: 'SignInWithApple' }] }),
    );
    expect(identity.authProvider).toBe('apple');
    expect(identity.emailVerified).toBe(false);
  });

  it('treats a token without identities as a user pool password sign-in', () => {
    const identity = mapCognitoIdentity(buildPayload({ email_verified: true }));
    expect(identity.authProvider).toBe('password');
    expect(identity.emailVerified).toBe(true);
  });

  it('rejects an unknown federated provider', () => {
    expect(() =>
      mapCognitoIdentity(
        buildPayload({ identities: [{ providerName: 'Facebook' }] }),
      ),
    ).toThrow(UnauthorizedException);
  });

  it('rejects a token without an email claim', () => {
    expect(() =>
      mapCognitoIdentity(buildPayload({ email: undefined })),
    ).toThrow(UnauthorizedException);
  });

  it('prefers given_name / family_name for the new account name', () => {
    const identity = mapCognitoIdentity(
      buildPayload({ given_name: 'Jane', family_name: 'Okoye', name: 'J O' }),
    );
    expect(identity).toMatchObject({ firstName: 'Jane', lastName: 'Okoye' });
  });

  it('splits the name claim when given_name is missing', () => {
    const identity = mapCognitoIdentity(
      buildPayload({ name: 'Jane Van Okoye' }),
    );
    expect(identity).toMatchObject({
      firstName: 'Jane',
      lastName: 'Van Okoye',
    });
  });
});
