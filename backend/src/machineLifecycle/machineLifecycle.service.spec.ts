import { ConflictException, ForbiddenException } from '@nestjs/common';
import {
  actor,
  findTransitionParams,
  now,
  setUpLifecycleService,
} from './machineLifecycleSpecSetup';

describe('MachineLifecycleService.applyAction', () => {
  it("activates a machine, counted from today in the account's time zone", async () => {
    const { service, database } = setUpLifecycleService();
    const result = await service.applyAction(
      actor,
      'machine-1',
      'activate',
      null,
      now,
    );
    expect(result).toMatchObject({
      lifecycleState: 'active',
      countedFrom: '2026-04-21',
      billedUntilExclusive: null,
    });
    // machine, tenant, account, from, to, activatedOn, billingEnd
    expect(findTransitionParams(database)?.slice(0, 7)).toEqual([
      'machine-1',
      'tenant-1',
      'account-1',
      'registered',
      'active',
      '2026-04-21',
      null,
    ]);
  });

  it('sets up the organisation billing account on its first activation', async () => {
    const { service, createdAccounts } = setUpLifecycleService({
      hasNoBillingAccount: true,
    });
    await service.applyAction(actor, 'machine-1', 'activate', null, now);
    expect(createdAccounts).toEqual([
      {
        organisationId: 'tenant-1',
        name: 'Pit Crew',
        abn: null,
        billingEmail: 'a@b.c',
        timezone: null,
        choice: { term: 'monthly' },
      },
    ]);
  });

  it('adds a monthly ASSET_PRO plan when the account has none, so the machine is billed', async () => {
    const { service, createdSubscriptions } = setUpLifecycleService({
      hasNoMachinePlan: true,
    });
    await service.applyAction(actor, 'machine-1', 'activate', null, now);
    expect(createdSubscriptions).toEqual([
      expect.objectContaining({
        billingAccountId: 'account-1',
        planCode: 'ASSET_PRO',
        reason: 'first machine activation',
      }),
    ]);
  });

  it('keeps the existing machine plan', async () => {
    const { service, createdSubscriptions } = setUpLifecycleService();
    await service.applyAction(actor, 'machine-1', 'activate', null, now);
    expect(createdSubscriptions).toEqual([]);
  });

  it('never creates a billing account to deactivate', async () => {
    const { service, createdAccounts } = setUpLifecycleService({
      lifecycleState: 'active',
      hasNoBillingAccount: true,
    });
    await service.applyAction(actor, 'machine-1', 'deactivate', null, now);
    expect(createdAccounts).toEqual([]);
  });

  it('deactivates: still billed this month, not from next month', async () => {
    const { service } = setUpLifecycleService({ lifecycleState: 'active' });
    const result = await service.applyAction(
      actor,
      'machine-1',
      'deactivate',
      'parked',
      now,
    );
    expect(result).toMatchObject({
      lifecycleState: 'registered',
      billedUntilExclusive: '2026-05-01',
    });
  });

  it('audits the transition with actor, from, to and reason', async () => {
    const { service, database } = setUpLifecycleService({
      lifecycleState: 'active',
    });
    await service.applyAction(actor, 'machine-1', 'archive', 'scrapped', now);
    const audit = database.queries.find((entry) =>
      entry.sql.includes('billing.record_audit_entry'),
    );
    expect(audit?.params[1]).toBe('admin-1');
    expect(audit?.params[5]).toMatchObject({
      from: 'active',
      to: 'archived',
      reason: 'scrapped',
    });
  });

  it('T8: the activation reaching 500 machines raises one sales review task and is not refused', async () => {
    const { service, database } = setUpLifecycleService({
      activeMachinesAfter: 500,
    });
    const result = await service.applyAction(
      actor,
      'machine-1',
      'activate',
      null,
      now,
    );
    expect(result).toMatchObject({
      lifecycleState: 'active',
      enterpriseReviewRaised: true,
    });
    const taskInserts = database
      .writes()
      .filter((entry) => entry.sql.includes('billing.review_tasks'));
    expect(taskInserts).toHaveLength(1);
    expect(taskInserts[0].params[1]).toBe('enterprise_threshold');
  });

  it('T8: a later activation past 500 does not raise a second task', async () => {
    const { service } = setUpLifecycleService({
      activeMachinesAfter: 501,
      openEnterpriseTask: true,
    });
    const result = await service.applyAction(
      actor,
      'machine-1',
      'activate',
      null,
      now,
    );
    expect(result).toMatchObject({
      lifecycleState: 'active',
      enterpriseReviewRaised: false,
    });
  });

  it('refuses a new activation while the account is suspended', async () => {
    const { service, database } = setUpLifecycleService({ suspended: true });
    await expect(
      service.applyAction(actor, 'machine-1', 'activate', null, now),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(database.writes()).toEqual([]);
  });

  it('still lets a suspended account deactivate', async () => {
    const { service } = setUpLifecycleService({
      suspended: true,
      lifecycleState: 'active',
    });
    await expect(
      service.applyAction(actor, 'machine-1', 'deactivate', null, now),
    ).resolves.toMatchObject({ lifecycleState: 'registered' });
  });

  it('refuses an action that does not fit the current state', async () => {
    const { service } = setUpLifecycleService({ lifecycleState: 'archived' });
    await expect(
      service.applyAction(actor, 'machine-1', 'deactivate', null, now),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('reports a conflict when another admin changed the machine first', async () => {
    const { service } = setUpLifecycleService({ stateChangedMeanwhile: true });
    await expect(
      service.applyAction(actor, 'machine-1', 'activate', null, now),
    ).rejects.toThrow(/changed while you were working/);
  });

  it('sells only through a transfer', async () => {
    const { service } = setUpLifecycleService({ lifecycleState: 'active' });
    await expect(
      service.applyAction(actor, 'machine-1', 'sell', null, now),
    ).rejects.toThrow(/transferring it/);
  });
});

describe('MachineLifecycleService.applyBulkAction', () => {
  it('applies each machine on its own and reports the ones that failed', async () => {
    const { service } = setUpLifecycleService({ lifecycleState: 'active' });
    const result = await service.applyBulkAction(
      actor,
      ['machine-1', 'machine-2'],
      'activate',
      null,
    );
    expect(result.applied).toEqual([]);
    expect(result.failed.map((entry) => entry.machineId)).toEqual([
      'machine-1',
      'machine-2',
    ]);
  });
});
