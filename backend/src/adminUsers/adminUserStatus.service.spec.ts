import { AdminUserStatusService } from './adminUserStatus.service';
import * as adminUsersRepository from './adminUsers.repository';
import * as audit from '../common/audit/runAuditedChange';

jest.mock('./adminUsers.repository');
jest.mock('../common/audit/runAuditedChange');

const actor = { userId: 'owner-1', tenantId: 'org-a', email: 'o@a.com' };
const service = new AdminUserStatusService({} as never);

// Runs the change callback with a dummy client, like runAuditedChange.
const runChange = () =>
  jest
    .mocked(audit.runAuditedChange)
    .mockImplementation(
      async (_db, _actor, _msg, apply) => (await apply({} as never)).result,
    );

describe('AdminUserStatusService.setStatus', () => {
  afterEach(() => jest.resetAllMocks());

  it("refuses disabling the caller's own account", async () => {
    await expect(
      service.setStatus(actor, 'owner-1', { status: 'disabled' }),
    ).rejects.toMatchObject({ status: 400 });
    expect(audit.runAuditedChange).not.toHaveBeenCalled();
  });

  it('maps each refusal to a clear status', async () => {
    runChange();
    const cases: [adminUsersRepository.SetUserDisabledOutcome, number][] = [
      ['not_found', 404],
      ['last_owner', 409],
    ];
    for (const [outcome, status] of cases) {
      jest
        .mocked(adminUsersRepository.setUserDisabled)
        .mockResolvedValue(outcome);
      await expect(
        service.setStatus(actor, 'user-2', { status: 'disabled' }),
      ).rejects.toMatchObject({ status });
    }
  });

  it('disables and enables, auditing the new status', async () => {
    jest
      .mocked(audit.runAuditedChange)
      .mockImplementation(async (_db, _actor, _msg, apply) => {
        const { result, audit: entry } = await apply({} as never);
        expect(entry.metadata).toEqual({ status: 'disabled' });
        return result;
      });
    jest
      .mocked(adminUsersRepository.setUserDisabled)
      .mockResolvedValue('updated');
    await service.setStatus(actor, 'user-2', { status: 'disabled' });
    expect(adminUsersRepository.setUserDisabled).toHaveBeenCalledWith(
      {},
      { userId: 'user-2', disabled: true },
    );

    runChange();
    await service.setStatus(actor, 'user-2', { status: 'active' });
    expect(adminUsersRepository.setUserDisabled).toHaveBeenLastCalledWith(
      {},
      { userId: 'user-2', disabled: false },
    );
  });
});
