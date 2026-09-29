import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { runAuditedChange } from '../common/audit/runAuditedChange';
import * as subscriptionsRepository from './subscriptions.repository';
import {
  assertConsistentSubscription,
  todayUtc,
  toTenantSubscription,
} from './subscriptionRules';
import { ListSubscriptionsQueryDto } from './dto/listSubscriptionsQueryDto';
import { UpsertSubscriptionDto } from './dto/upsertSubscriptionDto';
import {
  SUBSCRIPTION_STATUSES,
  SubscriptionStatus,
  TenantSubscription,
  TenantSubscriptionList,
} from './types/subscriptionResponse';

const ORGANISATION_NOT_FOUND_MESSAGE = 'Organisation not found.';
// Only reachable if two admins save the same organisation at once.
const SAVE_CONFLICT_MESSAGE =
  'Someone else saved this subscription at the same time. Reload and try again.';

// Every organisation's subscription, including ones not set up yet.
@Injectable()
export class SubscriptionsService {
  constructor(private readonly databaseService: DatabaseService) {}

  listSubscriptions = async (
    query: ListSubscriptionsQueryDto,
  ): Promise<TenantSubscriptionList> => {
    const today = todayUtc();
    const rows = await subscriptionsRepository.listTenantSubscriptions(
      this.databaseService,
    );
    const all = rows.map((row) => toTenantSubscription(row, today));
    const statusCounts = Object.fromEntries(
      SUBSCRIPTION_STATUSES.map((status) => [
        status,
        all.filter((item) => item.status === status).length,
      ]),
    ) as Record<SubscriptionStatus, number>;
    const items = query.status
      ? all.filter((item) => item.status === query.status)
      : all;
    return { items, total: all.length, statusCounts };
  };

  getSubscription = async (tenantId: string): Promise<TenantSubscription> => {
    const [row] = await subscriptionsRepository.listTenantSubscriptions(
      this.databaseService,
      tenantId,
    );
    if (!row) throw new NotFoundException(ORGANISATION_NOT_FOUND_MESSAGE);
    return toTenantSubscription(row, todayUtc());
  };

  upsertSubscription = async (
    actor: AuthenticatedUser,
    tenantId: string,
    dto: UpsertSubscriptionDto,
  ): Promise<TenantSubscription> => {
    assertConsistentSubscription(dto);
    const before = await this.getSubscription(tenantId);
    await runAuditedChange(
      this.databaseService,
      actor,
      SAVE_CONFLICT_MESSAGE,
      async (client) => {
        const existed = await subscriptionsRepository.upsertTenantSubscription(
          client,
          {
            tenantId,
            updatedBy: actor.userId,
            terms: dto,
          },
        );
        if (existed === null)
          throw new NotFoundException(ORGANISATION_NOT_FOUND_MESSAGE);
        const metadata = {
          name: before.tenantName,
          before: before.subscription,
          after: { ...dto },
        };
        const audit = {
          action: existed ? 'update' : 'create',
          entityType: 'tenant_subscription',
        } as const;
        return {
          result: tenantId,
          audit: { ...audit, entityId: tenantId, metadata },
        };
      },
    );
    return this.getSubscription(tenantId);
  };
}
