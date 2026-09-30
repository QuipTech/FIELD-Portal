import { UserType } from '@aws-sdk/client-cognito-identity-provider';
import { classifyPasswordResetEligibility } from './passwordResetEligibility';

const passwordUser = (overrides: Partial<UserType> = {}): UserType => ({
  Username: 'a1b2c3',
  UserStatus: 'CONFIRMED',
  Enabled: true,
  ...overrides,
});

const federatedUser = (username: string): UserType => ({
  Username: username,
  UserStatus: 'EXTERNAL_PROVIDER',
  Enabled: true,
});

describe('classifyPasswordResetEligibility', () => {
  it('is not found when no user has the email', () => {
    expect(classifyPasswordResetEligibility([])).toEqual({
      status: 'notFound',
    });
  });

  it('is eligible for a confirmed password user', () => {
    expect(classifyPasswordResetEligibility([passwordUser()])).toEqual({
      status: 'eligible',
    });
  });

  it('is eligible when a password login sits alongside Google', () => {
    expect(
      classifyPasswordResetEligibility([
        federatedUser('google_1152270'),
        passwordUser(),
      ]),
    ).toEqual({ status: 'eligible' });
  });

  it('names the provider for Google- or Apple-only accounts', () => {
    expect(
      classifyPasswordResetEligibility([federatedUser('google_1152270')]),
    ).toEqual({ status: 'federatedOnly', provider: 'google' });
    expect(
      classifyPasswordResetEligibility([
        federatedUser('signinwithapple_0012ab'),
      ]),
    ).toEqual({ status: 'federatedOnly', provider: 'apple' });
  });

  it('flags a password login whose email was never verified', () => {
    expect(
      classifyPasswordResetEligibility([
        passwordUser({ UserStatus: 'UNCONFIRMED' }),
      ]),
    ).toEqual({ status: 'unverified' });
  });

  it('ignores disabled users', () => {
    expect(
      classifyPasswordResetEligibility([passwordUser({ Enabled: false })]),
    ).toEqual({ status: 'notFound' });
  });
});
