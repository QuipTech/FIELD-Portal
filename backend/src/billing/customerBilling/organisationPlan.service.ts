import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { ServiceDatabaseService } from '../../database/serviceDatabase.service';
import { listCurrentPeriods } from '../allowance/allowance.repository';
import {
  firstDayOfMonth,
  firstDayOfNextMonth,
  toBillingDay,
} from '../billingCalendar/billingDay';
import { BillingConfigService } from '../billingConfig/billingConfig.service';
import { firstSuspensionDay } from '../collections/overdueRules';
import { calculateOverCommitCents } from '../pricing/annualPricing';
import {
  calculateFleetPriceCents,
  findBandRateCents,
} from '../pricing/fleetPrice';
import { PriceBooksService } from '../priceBooks/priceBooks.service';
import { AnnualQuoteService } from '../signUp/annualQuote.service';
import { PLAN_CODES } from '../subscriptions/planCodes';
import { Subscription } from '../subscriptions/subscriptionTypes';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import * as planRepository from './organisationPlan.repository';

const NO_ACCOUNT_MESSAGE =
  'Your organisation has no billing account yet. It is set up when the first machine is activated.';
const NO_SELF_SERVE_PLAN_MESSAGE =
  'Your organisation is not on a self-serve plan. Contact QuipTech to change your contract.';
const ALREADY_CANCELLING_MESSAGE =
  'Your plan is already set to end. Keep it first to change the next term.';

// Plans an organisation can see and change itself; Enterprise and internal
// plans are QuipTech's to change.
const PLAN_ORDER: string[] = [
  PLAN_CODES.enterprise,
  PLAN_CODES.assetPro,
  PLAN_CODES.internal,
  PLAN_CODES.tech,
];

// The organisation's billing page (billing.manage): its plan, this month's
// charge so far, payment state, fair use, and the changes a customer may
// make themselves: annual or monthly from the next renewal, cancel at the
// end of the term, or keep a plan that is ending.
@Injectable()
export class OrganisationPlanService {
  constructor(
    private readonly serviceDatabase: ServiceDatabaseService,
    private readonly subscriptions: SubscriptionsService,
    private readonly priceBooks: PriceBooksService,
    private readonly annualQuotes: AnnualQuoteService,
    private readonly billingConfig: BillingConfigService,
  ) {}

  getSummary = async (actor: AuthenticatedUser, now = new Date()) => {
    const account = await this.requireAccount(actor);
    const today = toBillingDay(now, account.timezone);
    const monthStart = firstDayOfMonth(today);
    const [live, counts, overdue, allowance, config] = await Promise.all([
      this.subscriptions.listLiveSubscriptions(account.id),
      planRepository.findMachineCounts(
        this.serviceDatabase,
        account.id,
        monthStart,
        today,
      ),
      planRepository.findOverdueSummary(this.serviceDatabase, account.id),
      listCurrentPeriods(this.serviceDatabase, account.id, monthStart),
      this.billingConfig.loadConfig(),
    ]);
    const plan = pickPlan(live);
    const book = plan
      ? await this.priceBooks.getPinnedPriceBook(plan.priceBookId)
      : null;
    const thisMonth =
      book && plan ? estimateMonth(plan, book.bands, counts.peakSoFar) : null;
    const suspensionFrom = firstSuspensionDay(
      overdue.firstNoticeAt,
      config.SUSPENSION_NOTICE_DAYS,
    );
    return {
      account: {
        id: account.id,
        name: account.name,
        billingEmail: account.billing_email,
        timezone: account.timezone,
        suspendedAt: account.suspended_at?.toISOString() ?? null,
        hasStripeCustomer: Boolean(account.stripe_customer_id),
      },
      plan:
        plan && book
          ? {
              ...plan,
              planName: planName(plan.planCode),
              priceBookVersion: book.version,
              unitCents: book.unitCents,
              bands: book.bands,
            }
          : null,
      thisMonth: {
        periodStart: monthStart,
        invoicedOn: firstDayOfNextMonth(today),
        activeToday: counts.activeToday,
        peakSoFar: counts.peakSoFar,
        ...thisMonth,
      },
      overdue: {
        ...overdue,
        firstNoticeAt: overdue.firstNoticeAt?.toISOString() ?? null,
        suspensionFrom: suspensionFrom?.toISOString() ?? null,
      },
      allowance: allowance.map((row) => ({
        metric: row.metric,
        allowance: Number(row.allowance),
        used: Number(row.used),
        thresholdState: row.threshold_state,
      })),
    };
  };

  quoteAnnual = async (actor: AuthenticatedUser, committedQty: number) => {
    const account = await this.requireAccount(actor);
    return this.annualQuotes.quoteAssetPro(committedQty, account.timezone);
  };

  // Annual (committing to Q machines) or monthly, from the next renewal.
  chooseNextTerm = async (
    actor: AuthenticatedUser,
    choice: { term: 'monthly' } | { term: 'annual'; committedQty: number },
  ) => {
    const plan = await this.requireSelfServePlan(actor);
    if (plan.status === 'cancelling')
      throw new ConflictException(ALREADY_CANCELLING_MESSAGE);
    return this.subscriptions.chooseNextTerm(actor, plan.id, choice);
  };

  // Ends the plan at the end of the current term (no refund below Q).
  cancel = async (actor: AuthenticatedUser, reason: string) => {
    const plan = await this.requireSelfServePlan(actor);
    if (plan.status === 'cancelling') return plan;
    return this.subscriptions.cancelSubscription(actor, plan.id, reason);
  };

  keep = async (actor: AuthenticatedUser) => {
    const plan = await this.requireSelfServePlan(actor);
    return this.subscriptions.undoCancellation(actor, plan.id);
  };

  private requireAccount = async (actor: AuthenticatedUser) => {
    const account = await planRepository.findOrganisationAccountDetails(
      this.serviceDatabase,
      actor.tenantId,
    );
    if (!account) throw new NotFoundException(NO_ACCOUNT_MESSAGE);
    return account;
  };

  private requireSelfServePlan = async (actor: AuthenticatedUser) => {
    const account = await this.requireAccount(actor);
    const live = await this.subscriptions.listLiveSubscriptions(account.id);
    const plan = live.find((item) => item.planCode === PLAN_CODES.assetPro);
    if (!plan) throw new ConflictException(NO_SELF_SERVE_PLAN_MESSAGE);
    return plan;
  };
}

const pickPlan = (live: Subscription[]): Subscription | null =>
  [...live].sort(
    (a, b) => PLAN_ORDER.indexOf(a.planCode) - PLAN_ORDER.indexOf(b.planCode),
  )[0] ?? null;

const planName = (planCode: string) =>
  ({
    [PLAN_CODES.assetPro]: 'FIELD Asset Professional',
    [PLAN_CODES.enterprise]: 'FIELD Enterprise',
    [PLAN_CODES.internal]: 'QuipTech internal',
    [PLAN_CODES.tech]: 'FIELD Technician',
  })[planCode] ?? planCode;

// What this month costs so far, ex GST: price(peak) on monthly, the
// over-commit on annual (only machines above Q), nothing on a contract.
const estimateMonth = (
  plan: Subscription,
  bands: {
    bandNo: number;
    lowerQty: number;
    upperQty: number | null;
    unitCents: number;
  }[],
  peak: number,
) => {
  if (plan.planCode !== PLAN_CODES.assetPro || !bands.length)
    return { rateCents: null, estimateCents: 0 };
  const rateCents =
    peak > 0 ? findBandRateCents(bands, peak) : findBandRateCents(bands, 1);
  if (plan.term === 'annual')
    return {
      rateCents,
      estimateCents: calculateOverCommitCents(
        bands,
        peak,
        plan.committedQty ?? 0,
        plan.annualMonthsCharged ?? 0,
      ),
    };
  return { rateCents, estimateCents: calculateFleetPriceCents(bands, peak) };
};
