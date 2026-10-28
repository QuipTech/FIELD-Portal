import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ServiceDatabaseService } from '../../database/serviceDatabase.service';
import { BillingActor, recordBillingAudit } from '../billingAudit/billingAudit';
import { StripeService } from '../stripe/stripe.service';
import { customerUpdateKey } from '../stripe/stripeIdempotencyKeys';
import {
  attachOrganisation,
  BillingAccountDetailChanges,
  LockedBillingAccountRow,
  lockBillingAccount,
  updateBillingAccountDetails,
} from './billingAccountChanges.repository';
import {
  BillingAccount,
  toBillingAccount,
} from './types/billingAccountResponse';

const ACCOUNT_NOT_FOUND_MESSAGE = 'Billing account not found.';
const ORGANISATION_NOT_ATTACHABLE_MESSAGE =
  'Organisation not found, or it already belongs to a billing account.';

const describeDetails = (account: LockedBillingAccountRow) => ({
  name: account.name,
  abn: account.abn,
  billingEmail: account.billing_email,
  billingContactName: account.billing_contact_name,
  timezone: account.timezone,
});

// Edits to a billing account's details and organisations. Which fields a
// caller may change is the controller's decision (organisation admins:
// email and contact; super admins: everything).
@Injectable()
export class BillingAccountDetailsService {
  private readonly logger = new Logger(BillingAccountDetailsService.name);

  constructor(
    private readonly serviceDatabase: ServiceDatabaseService,
    private readonly stripeService: StripeService,
  ) {}

  updateDetails = async (
    actor: BillingActor,
    billingAccountId: string,
    changes: BillingAccountDetailChanges,
    reason: string | null,
  ): Promise<BillingAccount> => {
    const updated = await this.serviceDatabase.transaction(async (client) => {
      const current = await lockBillingAccount(client, billingAccountId);
      if (!current) throw new NotFoundException(ACCOUNT_NOT_FOUND_MESSAGE);
      const next = await updateBillingAccountDetails(
        client,
        billingAccountId,
        changes,
      );
      await recordBillingAudit(client, actor, {
        action: 'update',
        entityType: 'billing_account',
        entityId: billingAccountId,
        billingAccountId,
        from: describeDetails(current),
        to: describeDetails(next),
        reason,
      });
      return next;
    });
    await this.syncStripeCustomer(updated);
    return toBillingAccount(updated);
  };

  attachOrganisation = async (
    actor: BillingActor,
    billingAccountId: string,
    organisationId: string,
    reason: string,
  ): Promise<void> => {
    await this.serviceDatabase.transaction(async (client) => {
      const account = await lockBillingAccount(client, billingAccountId);
      if (!account) throw new NotFoundException(ACCOUNT_NOT_FOUND_MESSAGE);
      const attached = await attachOrganisation(
        client,
        billingAccountId,
        organisationId,
      );
      if (attached === 0) {
        throw new ConflictException(ORGANISATION_NOT_ATTACHABLE_MESSAGE);
      }
      await recordBillingAudit(client, actor, {
        action: 'update',
        entityType: 'billing_account',
        entityId: billingAccountId,
        billingAccountId,
        from: { organisationId, billingAccountId: null },
        to: { organisationId, billingAccountId },
        reason,
      });
    });
  };

  // Best effort: the FIELD change is saved either way. A failed sync is
  // logged and Stripe keeps the old details until the next change. An ABN
  // change isn't sent: Stripe tax ids are replaced, not updated, so that
  // moves with the invoice push work.
  private syncStripeCustomer = async (account: LockedBillingAccountRow) => {
    if (!account.stripe_customer_id) return;
    try {
      await this.stripeService.updateCustomer(
        account.stripe_customer_id,
        { name: account.name, email: account.billing_email },
        customerUpdateKey(account.id, account.row_version),
      );
    } catch (error) {
      this.logger.warn(
        `Stripe customer for billing account ${account.id} not updated: ${String(error)}`,
      );
    }
  };
}
