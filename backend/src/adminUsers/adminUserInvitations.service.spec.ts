import { AdminUserInvitationsService } from './adminUserInvitations.service';
import * as adminUsersRepository from './adminUsers.repository';
import * as adminRolesRepository from '../adminRoles/adminRoles.repository';
import * as authRepository from '../auth/auth.repository';
import * as audit from '../common/audit/runAuditedChange';
import * as removedAccounts from '../users/removedAccounts.repository';

jest.mock('./adminUsers.repository');
jest.mock('../adminRoles/adminRoles.repository');
jest.mock('../auth/auth.repository');
jest.mock('../common/audit/runAuditedChange');
jest.mock('../users/removedAccounts.repository');

const actor = { userId: 'u1', tenantId: 'org-a', email: 'owner@a.com' };
// A single-organisation scope (the Owner's list narrowed to one org).
const ownerScope = { tenantId: 'org-a', isPlatform: false };
const dto = {
  email: 'new@a.com',
  firstName: 'New',
  lastName: 'Person',
  roleId: 'role-1',
};

const setup = () => {
  const cognito = {
    createInvitedUser: jest
      .fn()
      .mockResolvedValue({ sub: 's1', username: 'new@a.com' }),
    deleteUser: jest.fn().mockResolvedValue(undefined),
  };
  jest
    .mocked(adminUsersRepository.listOrganisations)
    .mockResolvedValue([{ id: 'org-a', name: 'A' }]);
  jest
    .mocked(adminRolesRepository.listRoles)
    .mockResolvedValue([
      { id: 'role-1', name: 'Field Technician', tenant_id: null } as never,
    ]);
  jest.mocked(authRepository.findUserByEmailForLogin).mockResolvedValue(null);
  const cognitoUsers = {
    deleteCognitoUsersForEmail: jest.fn().mockResolvedValue(undefined),
  };
  jest.mocked(removedAccounts.isRemovedAccount).mockResolvedValue(false);
  const service = new AdminUserInvitationsService(
    {} as never,
    cognito as never,
    cognitoUsers as never,
  );
  return { service, cognito, cognitoUsers };
};

describe('AdminUserInvitationsService.inviteUser', () => {
  afterEach(() => jest.resetAllMocks());

  it('creates the Cognito user, then saves the invited account', async () => {
    const { service, cognito } = setup();
    jest.mocked(audit.runAuditedChange).mockResolvedValue('user-9');
    await expect(service.inviteUser(actor, ownerScope, dto)).resolves.toEqual({
      id: 'user-9',
    });
    expect(cognito.createInvitedUser).toHaveBeenCalledWith(dto);
    expect(cognito.deleteUser).not.toHaveBeenCalled();
  });

  it('re-invites a removed person: deletes their disabled sign-in first, then clears the removal', async () => {
    const { service, cognito, cognitoUsers } = setup();
    jest.mocked(removedAccounts.isRemovedAccount).mockResolvedValue(true);
    jest.mocked(audit.runAuditedChange).mockResolvedValue('user-9');
    await service.inviteUser(actor, ownerScope, dto);
    expect(cognitoUsers.deleteCognitoUsersForEmail).toHaveBeenCalledWith(
      'new@a.com',
    );
    expect(cognito.createInvitedUser).toHaveBeenCalled();
    expect(removedAccounts.clearRemovedAccount).toHaveBeenCalledWith(
      {},
      'new@a.com',
    );
  });

  it('removes the Cognito user again when saving fails', async () => {
    const { service, cognito } = setup();
    jest.mocked(audit.runAuditedChange).mockRejectedValue(new Error('db down'));
    await expect(service.inviteUser(actor, ownerScope, dto)).rejects.toThrow(
      'db down',
    );
    expect(cognito.deleteUser).toHaveBeenCalledWith('new@a.com');
  });

  it('never contacts Cognito for a role or organisation outside scope', async () => {
    const { service, cognito } = setup();
    // Another organisation's role isn't in this organisation's role list.
    jest.mocked(adminRolesRepository.listRoles).mockResolvedValue([]);
    await expect(
      service.inviteUser(actor, ownerScope, dto),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      service.inviteUser(actor, ownerScope, {
        ...dto,
        organisationId: 'org-b',
      }),
    ).rejects.toMatchObject({ status: 403 });
    expect(cognito.createInvitedUser).not.toHaveBeenCalled();
  });
});
