import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { ServiceDatabaseService } from '../../database/serviceDatabase.service';
import { findUserRoleNames } from '../../auth/userAccess.repository';
import { OWNER_ROLE_NAME } from '../../auth/systemRoleNames';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { BillingConfigService } from '../billingConfig/billingConfig.service';
import { PriceBooksService } from '../priceBooks/priceBooks.service';
import {
  firstDayOfMonth,
  firstDayOfNextMonth,
  toBillingDay,
} from '../billingCalendar/billingDay';
import {
  findPersonalAccount,
  findPersonalInvoiceHistory,
  findPersonalPeriods,
  hasOrganisationTechSeat,
} from './personalSubscription.repository';
import {
  isPersonalPeriodPaid,
  PersonalBillingStatus,
} from './personalSubscriptionTypes';

@Injectable()
export class PersonalSubscriptionService {
  constructor(
    private readonly database: DatabaseService,
    private readonly serviceDatabase: ServiceDatabaseService,
    private readonly config: BillingConfigService,
    private readonly priceBooks: PriceBooksService,
  ) {}

  isOwner = async (actor: AuthenticatedUser): Promise<boolean> => {
    const roles = await this.database.withTenant(actor.tenantId, (client) =>
      findUserRoleNames(client, actor.userId),
    );
    return roles.includes(OWNER_ROLE_NAME);
  };

  getStatus = async (
    actor: AuthenticatedUser,
    now = new Date(),
  ): Promise<PersonalBillingStatus> => {
    // Independent reads run together: each is a full round trip to the
    // database, and run one by one they made this endpoint take seconds.
    const [exempt, config] = await Promise.all([
      this.isOwner(actor),
      this.config.loadConfig(),
    ]);
    const [account, periods] = await Promise.all([
      exempt ? undefined : findPersonalAccount(this.serviceDatabase, actor),
      exempt ? [] : findPersonalPeriods(this.serviceDatabase, actor),
    ]);
    const timezone = account?.timezone ?? config.DEFAULT_BILLING_TIMEZONE;
    const today = toBillingDay(now, timezone);
    const periodStart = firstDayOfMonth(today);
    const periodEnd = firstDayOfNextMonth(today);
    const period = periods.find((item) => item.period_start === periodStart);
    const [book, coveredByOrganisation] = exempt
      ? [null, false]
      : await Promise.all([
          period
            ? this.priceBooks.getPinnedPriceBook(period.price_book_id)
            : this.priceBooks.getPriceBookInEffect('TECH', today),
          hasOrganisationTechSeat(this.serviceDatabase, actor.userId, today),
        ]);
    return {
      exempt,
      coveredByOrganisation,
      paymentRequired:
        !exempt && !coveredByOrganisation && !isPersonalPeriodPaid(period),
      monthlyCents: book?.unitCents ?? 0,
      currency: 'AUD',
      timezone,
      priceBookId: book?.id ?? null,
      periodStart,
      periodEnd,
      invoiceId: period?.invoice_id ?? null,
      invoiceStatus: period?.status ?? null,
      gstCents: period?.gst_cents == null ? null : Number(period.gst_cents),
      totalCents:
        period?.total_cents == null ? null : Number(period.total_cents),
      hostedInvoiceUrl: period?.hosted_invoice_url ?? null,
    };
  };

  listInvoices = async (actor: AuthenticatedUser) =>
    (await findPersonalInvoiceHistory(this.serviceDatabase, actor))
      .filter((period) => period.status !== 'draft')
      .map((period) => ({
        invoiceId: period.invoice_id,
        periodStart: period.period_start,
        periodEnd: period.period_end,
        status: period.status,
        totalExGstCents: Number(period.unit_cents),
        gstCents: period.gst_cents === null ? null : Number(period.gst_cents),
        totalCents:
          period.total_cents === null ? null : Number(period.total_cents),
        hostedInvoiceUrl: period.hosted_invoice_url,
      }));
}
