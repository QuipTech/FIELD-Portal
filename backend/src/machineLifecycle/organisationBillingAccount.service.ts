import { ConflictException, Injectable } from '@nestjs/common';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { BillingAccountsService } from '../billing/billingAccounts/billingAccounts.service';
import { BillingSignUpService } from '../billing/signUp/billingSignUp.service';
import { PLAN_CODES } from '../billing/subscriptions/planCodes';
import { SubscriptionsService } from '../billing/subscriptions/subscriptions.service';
import { listLiveSubscriptions } from '../billing/subscriptions/subscriptions.repository';
import { DatabaseService } from '../database/database.service';
import { ServiceDatabaseService } from '../database/serviceDatabase.service';
import { findOrganisationBilling } from './machineLifecycle.repository';

const UNIQUE_VIOLATION_CODE = '23505';

// Plans that pay for active machines. Enterprise and internal accounts are
// invoiced outside the monthly ASSET_PRO line, so they need nothing more.
const MACHINE_PLANS: string[] = [
  PLAN_CODES.assetPro,
  PLAN_CODES.enterprise,
  PLAN_CODES.internal,
];

// Self-serve billing set-up on the first activation. An organisation with
// no billing account signs up: an account in its name, billed to the
// activating administrator's email, in the default time zone, with a
// monthly ASSET_PRO subscription (spec T22: no trial, no lock-in). An
// account set up by a platform admin without a machine plan gets the same
// monthly subscription, so every active machine is billed in arrears on
// the next monthly run.
@Injectable()
export class OrganisationBillingAccountService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly serviceDatabase: ServiceDatabaseService,
    private readonly billingAccountsService: BillingAccountsService,
    private readonly billingSignUpService: BillingSignUpService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  ensureForActivation = async (actor: AuthenticatedUser): Promise<void> => {
    const organisation = await this.findOrganisation(actor);
    if (!organisation) return;
    if (organisation.billing_account_id) {
      await this.ensureMachinePlan(actor, organisation.billing_account_id);
      return;
    }
    try {
      await this.billingSignUpService.signUp(actor, {
        organisationId: actor.tenantId,
        name: organisation.name,
        abn: null,
        billingEmail: actor.email,
        timezone: null,
        choice: { term: 'monthly' },
      });
    } catch (error) {
      // A concurrent activation signed up first; make sure its plan exists.
      if (!(error instanceof ConflictException)) throw error;
      const current = await this.findOrganisation(actor);
      if (current?.billing_account_id)
        await this.ensureMachinePlan(actor, current.billing_account_id);
    }
  };

  private findOrganisation = (actor: AuthenticatedUser) =>
    this.databaseService.withTenant(actor.tenantId, (client) =>
      findOrganisationBilling(client, actor.tenantId),
    );

  private ensureMachinePlan = async (
    actor: AuthenticatedUser,
    billingAccountId: string,
  ): Promise<void> => {
    const live = await listLiveSubscriptions(
      this.serviceDatabase,
      billingAccountId,
    );
    if (
      live.some((subscription) =>
        MACHINE_PLANS.includes(subscription.plan_code),
      )
    )
      return;
    const account =
      await this.billingAccountsService.requireAccount(billingAccountId);
    const plan = await this.subscriptionsService.planNewTerm(
      PLAN_CODES.assetPro,
      { term: 'monthly' },
      account.timezone,
    );
    try {
      await this.serviceDatabase.transaction((client) =>
        this.subscriptionsService.createSubscription(client, actor, {
          billingAccountId,
          planCode: PLAN_CODES.assetPro,
          plan,
          reason: 'first machine activation',
        }),
      );
    } catch (error) {
      // Another activation created it at the same moment.
      if ((error as { code?: string } | null)?.code !== UNIQUE_VIOLATION_CODE)
        throw error;
    }
  };
}
