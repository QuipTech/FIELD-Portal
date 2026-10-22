import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ServiceDatabaseService } from '../../database/serviceDatabase.service';
import { BillingAccountsService } from '../billingAccounts/billingAccounts.service';
import { BillingActor, recordBillingAudit } from '../billingAudit/billingAudit';
import { BillingConfigService } from '../billingConfig/billingConfig.service';
import { PLAN_CODES } from '../subscriptions/planCodes';
import {
  SubscriptionsService,
  TermChoice,
} from '../subscriptions/subscriptions.service';
import { Subscription } from '../subscriptions/subscriptionTypes';

const UNIQUE_VIOLATION_CODE = '23505';
const ORGANISATION_NOT_FOUND_MESSAGE = 'Organisation not found.';
const ALREADY_SIGNED_UP_MESSAGE =
  'This organisation already has a billing account.';

export interface SignUpBillingInput {
  organisationId: string;
  name: string;
  abn: string | null;
  billingEmail: string;
  timezone: string | null;
  choice: TermChoice;
}

export interface SignUpBillingResult {
  billingAccountId: string;
  subscription: Subscription;
}

// A new organisation's billing: its account and an ASSET_PRO subscription
// that starts straight away, monthly (no lock-in) unless the customer
// chose annual. There is no trial or pilot (T22). The annual up-front
// invoice is raised by the invoicing engine from this subscription.
@Injectable()
export class BillingSignUpService {
  private readonly logger = new Logger(BillingSignUpService.name);

  constructor(
    private readonly serviceDatabase: ServiceDatabaseService,
    private readonly billingConfigService: BillingConfigService,
    private readonly billingAccountsService: BillingAccountsService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  signUp = async (
    actor: BillingActor,
    input: SignUpBillingInput,
    now = new Date(),
  ): Promise<SignUpBillingResult> => {
    const timezone =
      input.timezone ??
      (await this.billingConfigService.loadConfig()).DEFAULT_BILLING_TIMEZONE;
    const plan = await this.subscriptionsService.planNewTerm(
      PLAN_CODES.assetPro,
      input.choice,
      timezone,
      now,
    );

    const result = await this.runSignUp(async () =>
      this.serviceDatabase.transaction(async (client) => {
        const created = await client.query<{ id: string | null }>(
          `SELECT admin_create_billing_account($1, $2, $3, $4, $5) AS id`,
          [
            input.organisationId,
            input.name,
            input.abn,
            input.billingEmail,
            timezone,
          ],
        );
        const billingAccountId = created.rows[0]?.id;
        if (!billingAccountId)
          throw new NotFoundException(ORGANISATION_NOT_FOUND_MESSAGE);
        await recordBillingAudit(client, actor, {
          action: 'create',
          entityType: 'billing_account',
          entityId: billingAccountId,
          billingAccountId,
          from: null,
          to: { name: input.name, organisationId: input.organisationId },
          reason: 'sign-up',
        });
        const subscription = await this.subscriptionsService.createSubscription(
          client,
          actor,
          {
            billingAccountId,
            planCode: PLAN_CODES.assetPro,
            plan,
            reason: 'sign-up',
          },
        );
        return { billingAccountId, subscription };
      }),
    );
    await this.createStripeCustomer(result.billingAccountId);
    return result;
  };

  private runSignUp = async <T>(work: () => Promise<T>): Promise<T> => {
    try {
      return await work();
    } catch (error) {
      if ((error as { code?: string } | null)?.code === UNIQUE_VIOLATION_CODE)
        throw new ConflictException(ALREADY_SIGNED_UP_MESSAGE);
      throw error;
    }
  };

  // Best effort, as for an admin-created account: without Stripe the
  // account still exists and the first invoice creates the customer.
  private createStripeCustomer = async (billingAccountId: string) => {
    try {
      await this.billingAccountsService.ensureStripeCustomer(
        await this.billingAccountsService.requireAccount(billingAccountId),
      );
    } catch (error) {
      this.logger.warn(
        `Billing account ${billingAccountId} signed up without a Stripe customer: ${String(error)}`,
      );
    }
  };
}
