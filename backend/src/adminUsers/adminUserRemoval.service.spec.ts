import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AdminUserRemovalService } from './adminUserRemoval.service';
import * as removalRepository from './adminUserRemoval.repository';

jest.mock('./adminUserRemoval.repository');

const actor = { userId: 'owner-1', tenantId: 'org-a', email: 'owner@a.com' };
const TARGET = {
  tenant_id: 'org-b',
  email: 'tech@b.com',
  cognito_sub: 'sub-1',
  avatar_storage_key: 'avatars/org-b/user-2.png',
  is_last_owner: false,
};

const setup = () => {
  const cognitoUsers = {
    disableCognitoUsersForAccount: jest.fn().mockResolvedValue(undefined),
  };
  const storage = { deleteFile: jest.fn().mockResolvedValue(undefined) };
  jest.mocked(removalRepository.findRemovableUser).mockResolvedValue(TARGET);
  jest.mocked(removalRepository.removeUser).mockResolvedValue('removed');
  const service = new AdminUserRemovalService(
    {} as never,
    cognitoUsers as never,
    storage as never,
  );
  return { service, cognitoUsers, storage };
};

describe('AdminUserRemovalService.removeUser', () => {
  afterEach(() => jest.resetAllMocks());

  it('disables their sign-in, then deletes the account and avatar', async () => {
    const { service, cognitoUsers, storage } = setup();
    await service.removeUser(actor, 'user-2');
    expect(cognitoUsers.disableCognitoUsersForAccount).toHaveBeenCalledWith(
      TARGET,
    );
    expect(removalRepository.removeUser).toHaveBeenCalledWith(
      {},
      { userId: 'user-2', removedBy: 'owner-1' },
    );
    expect(storage.deleteFile).toHaveBeenCalledWith(
      TARGET.avatar_storage_key,
      'org-b',
    );
  });

  it("doesn't remove yourself", async () => {
    const { service } = setup();
    await expect(service.removeUser(actor, 'owner-1')).rejects.toThrow(
      BadRequestException,
    );
    expect(removalRepository.removeUser).not.toHaveBeenCalled();
  });

  it('never removes the last Owner, and leaves their sign-in alone', async () => {
    const { service, cognitoUsers } = setup();
    jest
      .mocked(removalRepository.findRemovableUser)
      .mockResolvedValue({ ...TARGET, is_last_owner: true });
    await expect(service.removeUser(actor, 'user-2')).rejects.toThrow(
      ConflictException,
    );
    expect(cognitoUsers.disableCognitoUsersForAccount).not.toHaveBeenCalled();
  });

  it('answers 404 for an unknown user', async () => {
    const { service } = setup();
    jest.mocked(removalRepository.findRemovableUser).mockResolvedValue(null);
    await expect(service.removeUser(actor, 'user-x')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('removes nothing when their sign-in could not be disabled', async () => {
    const { service, cognitoUsers } = setup();
    cognitoUsers.disableCognitoUsersForAccount.mockRejectedValue(
      new Error('AccessDeniedException'),
    );
    await expect(service.removeUser(actor, 'user-2')).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(removalRepository.removeUser).not.toHaveBeenCalled();
  });
});
