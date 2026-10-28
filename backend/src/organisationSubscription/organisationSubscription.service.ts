import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { todayUtc } from '../adminSubscriptions/subscriptionRules';
import { findOrganisationSubscription } from './organisationSubscription.repository';
import { toOrganisationSubscription } from './organisationSubscriptionRules';
import { OrganisationSubscription } from './types/organisationSubscriptionResponse';

// The signed-in user's own organisation plan, read through the tenant role
// from its billing account's subscriptions (RLS: own account only). Never
// Stripe: FIELD's billing tables are the source of truth.
@Injectable()
export class OrganisationSubscriptionService {
  constructor(private readonly databaseService: DatabaseService) {}

  getSubscription = async (
    tenantId: string,
  ): Promise<OrganisationSubscription> => {
    const row = await this.databaseService.withTenant(tenantId, (client) =>
      findOrganisationSubscription(client, tenantId),
    );
    return toOrganisationSubscription(row, todayUtc());
  };
}
