import { Injectable } from '@nestjs/common';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { BillingAccountsService } from '../billing/billingAccounts/billingAccounts.service';
import { BillingConfigService } from '../billing/billingConfig/billingConfig.service';
import {
  firstDayOfMonth,
  firstDayOfNextMonth,
  toBillingDay,
} from '../billing/billingCalendar/billingDay';
import { PriceBooksService } from '../billing/priceBooks/priceBooks.service';
import { PLAN_CODES } from '../billing/subscriptions/planCodes';
import { listLiveSubscriptions } from '../billing/subscriptions/subscriptions.repository';
import { DatabaseService } from '../database/database.service';
import { ServiceDatabaseService } from '../database/serviceDatabase.service';
import { quoteActivation } from './activationQuote';
import {
  countActiveMachinesOnDay,
  findPeakSoFar,
} from './machineActivations.repository';
import { findOrganisationBilling } from './machineLifecycle.repository';

const CONTRACT_PLANS: string[] = [PLAN_CODES.enterprise, PLAN_CODES.internal];

// The price shown before a machine is activated. Machines are billed
// monthly in arrears (spec sections 3 and 9): nothing is charged at
// activation; the month's peak is invoiced on the 1st of next month.
@Injectable()
export class ActivationQuoteService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly serviceDatabase: ServiceDatabaseService,
    private readonly billingAccountsService: BillingAccountsService,
    private readonly billingConfigService: BillingConfigService,
    private readonly priceBooksService: PriceBooksService,
  ) {}

  getQuote = async (
    actor: AuthenticatedUser,
    adding: number,
    now = new Date(),
  ) => {
    const organisation = await this.databaseService.withTenant(
      actor.tenantId,
      (client) => findOrganisationBilling(client, actor.tenantId),
    );
    const accountId = organisation?.billing_account_id ?? null;
    const [account, subscriptions, config] = await Promise.all([
      accountId ? this.billingAccountsService.requireAccount(accountId) : null,
      accountId ? listLiveSubscriptions(this.serviceDatabase, accountId) : [],
      this.billingConfigService.loadConfig(),
    ]);
    const timezone = account?.timezone ?? config.DEFAULT_BILLING_TIMEZONE;
    const today = toBillingDay(now, timezone);
    const invoicedOn = firstDayOfNextMonth(today);
    if (subscriptions.some((item) => CONTRACT_PLANS.includes(item.plan_code)))
      return { pricing: 'contract' as const, timezone, invoicedOn };

    const assetPro = subscriptions.find(
      (item) => item.plan_code === PLAN_CODES.assetPro,
    );
    const [book, counts] = await Promise.all([
      assetPro
        ? this.priceBooksService.getPinnedPriceBook(assetPro.price_book_id)
        : this.priceBooksService.getPriceBookInEffect(
            PLAN_CODES.assetPro,
            today,
          ),
      accountId
        ? this.serviceDatabase.transaction(async (client) => ({
            activeToday: await countActiveMachinesOnDay(
              client,
              accountId,
              today,
            ),
            peakSoFar: await findPeakSoFar(
              client,
              accountId,
              firstDayOfMonth(today),
              today,
            ),
          }))
        : { activeToday: 0, peakSoFar: 0 },
    ]);
    return {
      pricing: 'per_machine' as const,
      term: assetPro?.term ?? 'monthly',
      // Annual accounts pay up front for this many; only the peak above it is extra.
      committedQty: assetPro?.committed_qty ?? null,
      timezone,
      invoicedOn,
      activeToday: counts.activeToday,
      ...quoteActivation({ bands: book.bands, ...counts, adding }),
      bands: book.bands.map((band) => ({
        from: band.lowerQty,
        to: band.upperQty,
        unitCents: band.unitCents,
      })),
    };
  };
}
