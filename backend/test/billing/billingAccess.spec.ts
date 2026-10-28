import { ForbiddenException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { assertNewSessionAllowed } from '../../src/aiAssistant/aiSessionAccess';
import { EntitlementsService } from '../../src/entitlements/entitlements.service';
import { assertFullMachineAccess } from '../../src/machineLifecycle/activeMachine/activeMachine.repository';
import { findOrganisationSubscription } from '../../src/organisationSubscription/organisationSubscription.repository';
import { toOrganisationSubscription } from '../../src/organisationSubscription/organisationSubscriptionRules';
import {
  BillingTestDatabase,
  createBillingTestDatabase,
} from './billingTestDatabase';

// What the tenant role sees and may start, from the billing plan: the
// plan badge, feature keys, new AI sessions under suspension, and machine
// history after a plan ends.
describe('access from the billing plan', () => {
  let fixture: BillingTestDatabase;

  beforeAll(async () => {
    fixture = await createBillingTestDatabase();
  });
  afterAll(() => fixture.db.close());
  beforeEach(() => fixture.db.exec('BEGIN'));
  afterEach(() => fixture.db.exec('ROLLBACK'));

  const asCustomer = <T>(work: (client: PoolClient) => Promise<T>) =>
    fixture.asRole('field_app', { tenantId: fixture.ids.customerTenant }, work);
  const accountSql = '(SELECT billing_account_id FROM tenants WHERE id = $1)';

  it('shows the billing plan as the organisation plan badge', async () => {
    const row = await asCustomer((client) =>
      findOrganisationSubscription(client, fixture.ids.customerTenant),
    );
    expect(toOrganisationSubscription(row, '2026-10-26')).toMatchObject({
      status: 'active',
      planCode: 'ASSET_PRO',
      planName: 'FIELD Asset Professional',
      renewsAutomatically: true,
    });
  });

  it('resolves feature keys through the entitlements service', async () => {
    const service = new EntitlementsService(fixture.database);
    expect(
      await service.hasFeature(fixture.ids.customerTenant, 'fleet.register'),
    ).toBe(true);
    expect(
      await service.hasFeature(fixture.ids.customerTenant, 'whitelabel'),
    ).toBe(false);
    expect(
      await service.hasFeature(fixture.ids.platformTenant, 'whitelabel'),
    ).toBe(true);
  });

  it('refuses a new AI session while suspended, and allows it otherwise (T30)', async () => {
    await expect(asCustomer(assertNewSessionAllowed)).resolves.toBeUndefined();
    await fixture.query(
      `UPDATE billing.billing_accounts SET suspended_at = now() WHERE id = ${accountSql}`,
      [fixture.ids.customerTenant],
    );
    await expect(asCustomer(assertNewSessionAllowed)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'account_suspended' }),
    });
  });

  it('limits an active machine like an inactive one once the plan has ended', async () => {
    const machineId = await fixture.insertMachine(fixture.ids.customerTenant);
    await fixture.query(
      `UPDATE machines SET lifecycle_state = 'active' WHERE id = $1`,
      [machineId],
    );
    await expect(
      asCustomer((client) =>
        assertFullMachineAccess(client, fixture.ids.customerTenant, machineId),
      ),
    ).resolves.toBe('allowed');
    await fixture.query(
      `UPDATE billing.subscriptions SET status = 'cancelled', cancel_at = current_date
       WHERE billing_account_id = ${accountSql}`,
      [fixture.ids.customerTenant],
    );
    await expect(
      asCustomer((client) =>
        assertFullMachineAccess(client, fixture.ids.customerTenant, machineId),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
