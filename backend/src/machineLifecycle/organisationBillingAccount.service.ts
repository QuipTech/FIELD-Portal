import { ConflictException, Injectable } from '@nestjs/common';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { BillingAccountsService } from '../billing/billingAccounts/billingAccounts.service';
import { DatabaseService } from '../database/database.service';
import { findOrganisationBilling } from './machineLifecycle.repository';

// Self-serve billing set-up: the first activation by an organisation with
// no billing account creates one in the organisation's name, billed to the
// activating administrator's email, in the platform's default time zone.
// A platform admin can still set one up first (Admin → Billing accounts).
@Injectable()
export class OrganisationBillingAccountService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly billingAccountsService: BillingAccountsService,
  ) {}

  ensureForActivation = async (actor: AuthenticatedUser): Promise<void> => {
    const organisation = await this.databaseService.withTenant(actor.tenantId, (client) =>
      findOrganisationBilling(client, actor.tenantId),
    );
    if (!organisation || organisation.billing_account_id) return;
    try {
      await this.billingAccountsService.createAccount(actor, {
        organisationId: actor.tenantId,
        name: organisation.name,
        billingEmail: actor.email,
      });
    } catch (error) {
      // A concurrent activation created it first; that account is used.
      if (!(error instanceof ConflictException)) throw error;
    }
  };
}
