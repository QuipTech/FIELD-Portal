import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { ServiceDatabaseService } from '../../database/serviceDatabase.service';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { runAuditedChange } from '../../common/audit/runAuditedChange';
import { BillingConfigService } from '../billingConfig/billingConfig.service';
import { StripeService } from '../stripe/stripe.service';
import { customerCreateKey } from '../stripe/stripeIdempotencyKeys';
import { toStripeGatewayError } from '../stripe/stripeErrors';
import * as billingAccountsRepository from './billingAccounts.repository';
import { CreateBillingAccountDto } from './dto/createBillingAccountDto';
import { BillingAccountRow } from './types/billingAccountRows';
import {
  BillingAccount,
  OrganisationBilling,
  toBillingAccount,
  toOrganisationBilling,
} from './types/billingAccountResponse';

const ORGANISATION_NOT_FOUND_MESSAGE = 'Organisation not found.';
const ACCOUNT_NOT_FOUND_MESSAGE = 'Billing account not found.';
const ALREADY_LINKED_MESSAGE =
  'This organisation already has a billing account.';

@Injectable()
export class BillingAccountsService {
  private readonly logger = new Logger(BillingAccountsService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly serviceDatabase: ServiceDatabaseService,
    private readonly stripeService: StripeService,
    private readonly billingConfigService: BillingConfigService,
  ) {}

  listOrganisations = async (): Promise<OrganisationBilling[]> => {
    const rows = await billingAccountsRepository.listOrganisationsWithBilling(
      this.serviceDatabase,
    );
    return rows.map(toOrganisationBilling);
  };

  // The account is saved (and audited) first. If Stripe is unreachable the
  // account is still returned, without a customer id — the first invoice
  // creates the customer instead (ensureStripeCustomer).
  createAccount = async (
    actor: AuthenticatedUser,
    dto: CreateBillingAccountDto,
  ): Promise<BillingAccount> => {
    const timezone =
      dto.timezone ??
      (await this.billingConfigService.loadConfig()).DEFAULT_BILLING_TIMEZONE;
    const accountId = await runAuditedChange(
      this.databaseService,
      actor,
      ALREADY_LINKED_MESSAGE,
      async (client) => {
        const id = await billingAccountsRepository.createBillingAccount(
          client,
          {
            organisationId: dto.organisationId,
            name: dto.name,
            abn: dto.abn ?? null,
            billingEmail: dto.billingEmail,
            timezone,
          },
        );
        if (!id) throw new NotFoundException(ORGANISATION_NOT_FOUND_MESSAGE);
        const metadata = { organisationId: dto.organisationId, name: dto.name };
        return {
          result: id,
          audit: {
            action: 'create',
            entityType: 'billing_account',
            entityId: id,
            metadata,
          },
        };
      },
    );
    const account = await this.requireAccount(accountId);
    try {
      return toBillingAccount(await this.ensureStripeCustomer(account));
    } catch (error) {
      this.logger.warn(
        `Billing account ${accountId} saved without a Stripe customer: ${String(error)}`,
      );
      return toBillingAccount(account);
    }
  };

  requireAccount = async (
    billingAccountId: string,
  ): Promise<BillingAccountRow> => {
    const account = await billingAccountsRepository.findBillingAccount(
      this.serviceDatabase,
      billingAccountId,
    );
    if (!account) throw new NotFoundException(ACCOUNT_NOT_FOUND_MESSAGE);
    return account;
  };

  // Idempotent: the key is derived from the account id, so a retry after a
  // lost response gets the same Stripe customer back.
  ensureStripeCustomer = async (
    account: BillingAccountRow,
  ): Promise<BillingAccountRow> => {
    if (account.stripe_customer_id) return account;
    try {
      const customer = await this.stripeService.createCustomer(
        {
          name: account.name,
          email: account.billing_email,
          abn: account.abn,
          billingAccountId: account.id,
        },
        customerCreateKey(account.id),
      );
      await billingAccountsRepository.saveStripeCustomerId(
        this.serviceDatabase,
        account.id,
        customer.id,
      );
      return { ...account, stripe_customer_id: customer.id };
    } catch (error) {
      throw toStripeGatewayError(error);
    }
  };
}
