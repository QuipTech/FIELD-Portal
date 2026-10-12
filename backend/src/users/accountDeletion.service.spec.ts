import {
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import * as usersRepository from './users.repository';
import { AccountDeletionService } from './accountDeletion.service';
import { CognitoUserDeletionService } from './cognitoUserDeletion.service';
import { StorageService } from '../storage/storage.service';

jest.mock('./users.repository');

const databaseService = {} as DatabaseService;
const account = {
  email: 'owner@quiptech.com',
  cognito_sub: 'sub-1',
  avatar_storage_key: null,
};

const buildService = (
  deleteCognitoUsersForAccount: jest.Mock,
  deleteFile: jest.Mock = jest.fn().mockResolvedValue(undefined),
) =>
  new AccountDeletionService(
    databaseService,
    { deleteCognitoUsersForAccount } as unknown as CognitoUserDeletionService,
    { deleteFile } as unknown as StorageService,
  );

describe('AccountDeletionService.deleteOwnAccount', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.mocked(usersRepository.findAccountIdentity).mockResolvedValue(account);
    jest.mocked(usersRepository.deleteUserAccount).mockResolvedValue(true);
    jest.mocked(usersRepository.isLastOwner).mockResolvedValue(false);
  });

  it("refuses to delete the organisation's last Owner, touching nothing", async () => {
    jest.mocked(usersRepository.isLastOwner).mockResolvedValue(true);
    const deleteCognitoUsers = jest.fn();

    await expect(
      buildService(deleteCognitoUsers).deleteOwnAccount('user-1', 'tenant-1'),
    ).rejects.toThrow(ConflictException);
    expect(deleteCognitoUsers).not.toHaveBeenCalled();
    expect(usersRepository.deleteUserAccount).not.toHaveBeenCalled();
  });

  it('deletes the Cognito users, then the database account', async () => {
    const deleteCognitoUsers = jest.fn().mockResolvedValue(undefined);

    await buildService(deleteCognitoUsers).deleteOwnAccount(
      'user-1',
      'tenant-1',
    );

    expect(deleteCognitoUsers).toHaveBeenCalledWith(account);
    expect(usersRepository.deleteUserAccount).toHaveBeenCalledWith(
      databaseService,
      { userId: 'user-1', tenantId: 'tenant-1' },
    );
  });

  it('deletes nothing from the database when Cognito fails', async () => {
    const deleteCognitoUsers = jest.fn().mockRejectedValue(new Error('AWS'));

    await expect(
      buildService(deleteCognitoUsers).deleteOwnAccount('user-1', 'tenant-1'),
    ).rejects.toThrow(ServiceUnavailableException);
    expect(usersRepository.deleteUserAccount).not.toHaveBeenCalled();
  });

  it('reports a missing account as not found, touching nothing', async () => {
    jest.mocked(usersRepository.findAccountIdentity).mockResolvedValue(null);
    const deleteCognitoUsers = jest.fn();

    await expect(
      buildService(deleteCognitoUsers).deleteOwnAccount('user-1', 'tenant-1'),
    ).rejects.toThrow(NotFoundException);
    expect(deleteCognitoUsers).not.toHaveBeenCalled();
  });

  it('deletes an uploaded avatar from storage after the account', async () => {
    jest.mocked(usersRepository.findAccountIdentity).mockResolvedValue({
      ...account,
      avatar_storage_key: 'avatars/tenant-1/user-1.png',
    });
    const deleteFile = jest.fn().mockResolvedValue(undefined);

    await buildService(
      jest.fn().mockResolvedValue(undefined),
      deleteFile,
    ).deleteOwnAccount('user-1', 'tenant-1');

    expect(deleteFile).toHaveBeenCalledWith(
      'avatars/tenant-1/user-1.png',
      'tenant-1',
    );
  });

  it('still succeeds when the avatar file cannot be deleted', async () => {
    jest.mocked(usersRepository.findAccountIdentity).mockResolvedValue({
      ...account,
      avatar_storage_key: 'avatars/tenant-1/user-1.png',
    });
    const deleteFile = jest.fn().mockRejectedValue(new Error('S3 down'));

    await expect(
      buildService(
        jest.fn().mockResolvedValue(undefined),
        deleteFile,
      ).deleteOwnAccount('user-1', 'tenant-1'),
    ).resolves.toBeUndefined();
  });
});
