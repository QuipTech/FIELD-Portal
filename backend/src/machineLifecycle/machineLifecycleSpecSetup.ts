import { BillingConfigService } from '../billing/billingConfig/billingConfig.service';
import { createRecordingDatabase } from '../billing/billingRecordingDatabase';
import { ReviewTasksService } from '../billing/reviewTasks/reviewTasks.service';
import { ENTERPRISE_THRESHOLD_MACHINES } from '../billing/pricing/priceBookV1Fixture';
import { DatabaseService } from '../database/database.service';
import { EnterpriseThresholdService } from './enterpriseThreshold.service';
import { MachineLifecycleService } from './machineLifecycle.service';
import { OrganisationBillingAccountService } from './organisationBillingAccount.service';
import { BillingAccountsService } from '../billing/billingAccounts/billingAccounts.service';

// The lifecycle service over a recording service-role pool and a fake
// tenant pool that returns one machine, for machineLifecycle.service.spec.

export const actor = {
  userId: 'admin-1',
  tenantId: 'tenant-1',
  email: 'a@b.c',
};
// 02:00 UTC on 21 April is 12:00 in Brisbane.
export const now = new Date('2026-04-21T02:00:00Z');

export interface Scenario {
  lifecycleState?: string;
  suspended?: boolean;
  activeMachinesAfter?: number;
  openEnterpriseTask?: boolean;
  stateChangedMeanwhile?: boolean;
  // The organisation has no billing account until activation creates one.
  hasNoBillingAccount?: boolean;
}

export const setUpLifecycleService = (scenario: Scenario = {}) => {
  const database = createRecordingDatabase((sql) => {
    if (sql.includes('apply_machine_transition'))
      return [{ event_id: scenario.stateChangedMeanwhile ? null : 'event-1' }];
    if (sql.includes('FROM billing.subscriptions')) return [{ id: 'sub-1' }];
    if (sql.includes('count(DISTINCT machine_id)'))
      return [{ count: String(scenario.activeMachinesAfter ?? 1) }];
    if (sql.includes('INSERT INTO billing.review_tasks'))
      return scenario.openEnterpriseTask ? [] : [{ id: 'task-1' }];
    return undefined;
  });
  const createdAccounts: unknown[] = [];
  const tenantDatabase = {
    withTenant: async (_tenantId: string, work: (client: unknown) => unknown) =>
      work({
        query: async (sql: string) => ({
          rows: sql.includes('FROM tenants')
            ? [{
                name: 'Pit Crew',
                billing_account_id:
                  scenario.hasNoBillingAccount && createdAccounts.length === 0 ? null : 'account-1',
              }]
            : [
            {
              id: 'machine-1',
              lifecycle_state: scenario.lifecycleState ?? 'registered',
              billing_account_id: 'account-1',
              timezone: 'Australia/Brisbane',
              suspended_at: scenario.suspended ? new Date() : null,
            },
          ],
        }),
      }),
  } as unknown as DatabaseService;
  const config = {
    loadConfig: async () => ({
      ENTERPRISE_THRESHOLD_MACHINES,
    }),
  } as unknown as BillingConfigService;
  const billingAccounts = {
    createAccount: async (_actor: unknown, account: unknown) => {
      createdAccounts.push(account);
    },
  } as unknown as BillingAccountsService;
  const service = new MachineLifecycleService(
    tenantDatabase,
    database.serviceDatabase,
    new EnterpriseThresholdService(config, new ReviewTasksService()),
    new OrganisationBillingAccountService(tenantDatabase, billingAccounts),
  );
  return { database, service, createdAccounts };
};

export const findTransitionParams = (
  database: ReturnType<typeof setUpLifecycleService>['database'],
) =>
  database.queries.find((entry) =>
    entry.sql.includes('apply_machine_transition'),
  )?.params;
