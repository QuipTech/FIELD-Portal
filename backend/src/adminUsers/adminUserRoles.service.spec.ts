import { AdminUserRolesService } from './adminUserRoles.service';
import * as adminUsersRepository from './adminUsers.repository';
import * as audit from '../common/audit/runAuditedChange';

jest.mock('./adminUsers.repository');
jest.mock('../common/audit/runAuditedChange');

const actor = { userId: 'owner-1', tenantId: 'org-a', email: 'o@a.com' };
const service = new AdminUserRolesService({} as never);

// Runs the change callback with a dummy client, like runAuditedChange.
const runChange = () =>
  jest
    .mocked(audit.runAuditedChange)
    .mockImplementation(
      async (_db, _actor, _msg, apply) => (await apply({} as never)).result,
    );

describe('AdminUserRolesService.changeRole', () => {
  afterEach(() => jest.resetAllMocks());

  it("refuses changing the caller's own role", async () => {
    await expect(
      service.changeRole(actor, 'owner-1', { roleId: 'r1' }),
    ).rejects.toMatchObject({ status: 400 });
    expect(audit.runAuditedChange).not.toHaveBeenCalled();
  });

  it('maps each refusal to a clear status', async () => {
    runChange();
    const cases: [adminUsersRepository.SetUserRoleOutcome, number][] = [
      ['not_found', 404],
      ['role_not_allowed', 400],
      ['last_owner', 409],
    ];
    for (const [outcome, status] of cases) {
      jest.mocked(adminUsersRepository.setUserRole).mockResolvedValue(outcome);
      await expect(
        service.changeRole(actor, 'user-2', { roleId: 'r1' }),
      ).rejects.toMatchObject({ status });
    }
  });

  it('saves the new role', async () => {
    runChange();
    jest.mocked(adminUsersRepository.setUserRole).mockResolvedValue('updated');
    await expect(
      service.changeRole(actor, 'user-2', { roleId: 'r1' }),
    ).resolves.toBeUndefined();
    expect(adminUsersRepository.setUserRole).toHaveBeenCalledWith(
      {},
      { userId: 'user-2', roleId: 'r1' },
    );
  });
});
