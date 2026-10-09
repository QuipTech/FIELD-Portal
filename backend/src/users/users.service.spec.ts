import { ForbiddenException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import * as authRepository from '../auth/auth.repository';
import { CognitoIdentity } from '../auth/types/cognitoIdentity';
import * as usersRepository from './users.repository';
import { createTenantAndFirstUserFromCognito } from './cognitoSignup';
import { ACCOUNT_REMOVED_MESSAGE, UsersService } from './users.service';
import * as removedAccounts from './removedAccounts.repository';

jest.mock('../auth/auth.repository');
jest.mock('./users.repository');
jest.mock('./cognitoSignup');
jest.mock('./removedAccounts.repository');

const googleIdentity: CognitoIdentity = {
  cognitoSub: 'sub-1',
  email: 'new@quiptech.com',
  emailVerified: true,
  authProvider: 'google',
  firstName: 'New',
  lastName: 'User',
  pictureUrl: 'https://lh3.googleusercontent.com/a/new-photo',
};

const createdUser = {
  id: 'user-1',
  tenant_id: 'tenant-1',
  email: 'new@quiptech.com',
  first_name: 'New',
  last_name: 'User',
  status: 'active',
  avatar_url: null,
  avatar_storage_key: null,
};

const buildService = () =>
  new UsersService({
    withTenant: jest.fn(),
  } as unknown as DatabaseService);

describe('UsersService.findOrCreateFromCognito', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.mocked(usersRepository.findUserByCognitoSub).mockResolvedValue(null);
    jest.mocked(authRepository.findUserByEmailForLogin).mockResolvedValue(null);
    jest.mocked(removedAccounts.isRemovedAccount).mockResolvedValue(false);
  });

  it('tells someone an admin removed that they were removed, instead of offering signup', async () => {
    jest.mocked(removedAccounts.isRemovedAccount).mockResolvedValue(true);
    await expect(
      buildService().findOrCreateFromCognito(googleIdentity, {
        companyName: 'Acme',
        phoneNumber: '+61400000000',
      }),
    ).rejects.toThrow(new ForbiddenException(ACCOUNT_REMOVED_MESSAGE));
    expect(createTenantAndFirstUserFromCognito).not.toHaveBeenCalled();
  });

  it('asks for a signup profile for a first-time user, creating nothing', async () => {
    const resolution =
      await buildService().findOrCreateFromCognito(googleIdentity);

    expect(resolution).toEqual({ status: 'profileRequired' });
    expect(createTenantAndFirstUserFromCognito).not.toHaveBeenCalled();
  });

  it('creates the account once company name and phone are provided', async () => {
    jest
      .mocked(createTenantAndFirstUserFromCognito)
      .mockResolvedValue(createdUser);
    const profile = { companyName: 'Acme Mining', phoneNumber: '+61400000000' };

    const resolution = await buildService().findOrCreateFromCognito(
      googleIdentity,
      profile,
    );

    expect(resolution).toEqual({ status: 'resolved', user: createdUser });
    expect(createTenantAndFirstUserFromCognito).toHaveBeenCalledWith(
      expect.anything(),
      googleIdentity,
      profile,
    );
  });

  it('signs an existing linked user straight in, without a profile', async () => {
    jest.mocked(usersRepository.findUserByCognitoSub).mockResolvedValue({
      ...createdUser,
      tenant_status: 'active',
    });

    const resolution =
      await buildService().findOrCreateFromCognito(googleIdentity);

    expect(resolution).toMatchObject({ status: 'resolved' });
    expect(createTenantAndFirstUserFromCognito).not.toHaveBeenCalled();
  });

  it('refreshes the saved photo on sign-in and returns the new one', async () => {
    jest.mocked(usersRepository.findUserByCognitoSub).mockResolvedValue({
      ...createdUser,
      avatar_url: 'https://lh3.googleusercontent.com/a/old-photo',
      tenant_status: 'active',
    });
    const client = {};
    const withTenant = jest.fn((_tenantId, work) => work(client));
    const service = new UsersService({
      withTenant,
    } as unknown as DatabaseService);

    const resolution = await service.findOrCreateFromCognito(googleIdentity);

    expect(usersRepository.recordCognitoSignIn).toHaveBeenCalledWith(client, {
      userId: 'user-1',
      pictureUrl: googleIdentity.pictureUrl,
    });
    expect(resolution).toMatchObject({
      user: { avatar_url: googleIdentity.pictureUrl },
    });
  });

  it('keeps the saved photo when the sign-in has none (Apple)', async () => {
    const savedPhoto = 'https://lh3.googleusercontent.com/a/old-photo';
    jest.mocked(usersRepository.findUserByCognitoSub).mockResolvedValue({
      ...createdUser,
      avatar_url: savedPhoto,
      tenant_status: 'active',
    });
    const withTenant = jest.fn((_tenantId, work) => work({}));
    const service = new UsersService({
      withTenant,
    } as unknown as DatabaseService);

    const resolution = await service.findOrCreateFromCognito({
      ...googleIdentity,
      authProvider: 'apple',
      pictureUrl: null,
    });

    expect(resolution).toMatchObject({ user: { avatar_url: savedPhoto } });
  });

  it('refuses signup for an unverified user-pool email', async () => {
    await expect(
      buildService().findOrCreateFromCognito({
        ...googleIdentity,
        authProvider: 'password',
        emailVerified: false,
      }),
    ).rejects.toThrow(ForbiddenException);
  });
});
