import { Injectable, Logger } from '@nestjs/common';
import { ServiceDatabaseService } from '../../database/serviceDatabase.service';
import {
  addDaysToDay,
  firstDayOfMonth,
  toBillingDay,
} from '../billingCalendar/billingDay';
import { BillingConfigService } from '../billingConfig/billingConfig.service';
import { BillingConfig } from '../billingConfig/billingConfigKeys';
import { BillingNotifier } from '../billingNotices/billingNotifier.service';
import { ReviewTasksService } from '../reviewTasks/reviewTasks.service';
import * as allowanceRepository from './allowance.repository';
import {
  ALLOWANCE_METRICS,
  AllowanceMetric,
  calculateAllowance,
  closeConsecutiveOver,
  nextThresholdState,
  PLAN_REVIEW_AFTER_MONTHS,
  ThresholdState,
  usageRatio,
} from './allowanceRules';

const METRIC_NAMES: Record<AllowanceMetric, string> = {
  ai_turns: 'AI assistant',
  storage_bytes: 'Storage',
  ingest_pages: 'Document ingestion',
};

// Fair use (spec section 6), from the hourly billing job, per account in
// its own time zone: this month's allowance and use for AI turns, storage
// and ingestion; billing admins hear at 80%; at 100% QuipTech hears too
// and the month is flagged; two months in a row over 100% raises a plan
// review. Nothing is ever charged, blocked or throttled.
@Injectable()
export class AllowanceService {
  private readonly logger = new Logger(AllowanceService.name);

  constructor(
    private readonly serviceDatabase: ServiceDatabaseService,
    private readonly billingConfig: BillingConfigService,
    private readonly notifier: BillingNotifier,
    private readonly reviewTasks: ReviewTasksService,
  ) {}

  runAllAccounts = async (now: Date): Promise<void> => {
    const [accounts, config] = await Promise.all([
      allowanceRepository.listAllowanceAccounts(this.serviceDatabase),
      this.billingConfig.loadConfig(),
    ]);
    for (const account of accounts) {
      try {
        await this.runAccount(account, config, now);
      } catch (error) {
        this.logger.error(
          `Allowance run failed for account ${account.id}: ${String(error)}`,
        );
      }
    }
  };

  runAccount = async (
    account: allowanceRepository.AllowanceAccountRow,
    config: BillingConfig,
    now: Date,
  ): Promise<void> => {
    const today = toBillingDay(now, account.timezone);
    const monthStart = firstDayOfMonth(today);
    const previousStart = firstDayOfMonth(addDaysToDay(monthStart, -1));
    const beforeStart = firstDayOfMonth(addDaysToDay(previousStart, -1));
    const periods = await allowanceRepository.listPeriods(
      this.serviceDatabase,
      account.id,
      [monthStart, previousStart, beforeStart],
    );
    const find = (start: string, metric: AllowanceMetric) =>
      periods.find(
        (row) => row.period_start === start && row.metric === metric,
      );

    await this.closeMonth(
      account,
      config,
      previousStart,
      monthStart,
      (metric) => ({
        open: find(previousStart, metric),
        before: find(beforeStart, metric),
      }),
    );

    const tomorrow = addDaysToDay(today, 1);
    const figures = await this.measure(account, config, monthStart, tomorrow);
    for (const metric of ALLOWANCE_METRICS) {
      const { allowance, used } = figures[metric];
      await allowanceRepository.upsertPeriod(this.serviceDatabase, {
        billingAccountId: account.id,
        periodStart: monthStart,
        metric,
        allowance,
        used,
      });
      const current: ThresholdState =
        find(monthStart, metric)?.threshold_state ?? 'ok';
      const ratio = usageRatio(used, allowance);
      const next = nextThresholdState(current, ratio, {
        notifyAt: config.AI_NOTIFY_THRESHOLD,
        flagAt: config.AI_FLAG_THRESHOLD,
      });
      if (
        next !== current &&
        (await allowanceRepository.advanceThreshold(this.serviceDatabase, {
          billingAccountId: account.id,
          periodStart: monthStart,
          metric,
          from: current,
          to: next,
        }))
      )
        await this.announce(account.id, metric, next, ratio);
      if (
        metric === 'ai_turns' &&
        config.AI_ABUSE_CEILING_MULTIPLIER !== null &&
        ratio >= config.AI_ABUSE_CEILING_MULTIPLIER
      )
        await this.raiseTask(account.id, 'abuse_flag', {
          reason: `AI use is ${formatRatio(ratio)} of this month's allowance, above the abuse ceiling of ${config.AI_ABUSE_CEILING_MULTIPLIER}×.`,
          details: { metric, periodStart: monthStart, used, allowance },
        });
    }
  };

  // Last month's final figures; two months running over 100% raises a
  // plan review (T26).
  private closeMonth = async (
    account: allowanceRepository.AllowanceAccountRow,
    config: BillingConfig,
    periodStart: string,
    periodEnd: string,
    rowsFor: (metric: AllowanceMetric) => {
      open?: allowanceRepository.AllowancePeriodRow;
      before?: allowanceRepository.AllowancePeriodRow;
    },
  ) => {
    const toClose = ALLOWANCE_METRICS.filter((metric) => {
      const row = rowsFor(metric).open;
      return row && !row.closed_at;
    });
    if (!toClose.length) return;
    const figures = await this.measure(account, config, periodStart, periodEnd);
    for (const metric of toClose) {
      const { open, before } = rowsFor(metric);
      const { allowance, used } = figures[metric];
      const consecutiveOver = closeConsecutiveOver(
        before?.consecutive_over ?? 0,
        used,
        allowance,
      );
      const closed = await allowanceRepository.closePeriod(
        this.serviceDatabase,
        open!.id,
        {
          allowance,
          used,
          consecutiveOver,
        },
      );
      if (closed && consecutiveOver >= PLAN_REVIEW_AFTER_MONTHS)
        await this.raiseTask(account.id, 'plan_review', {
          reason: `${METRIC_NAMES[metric]} use was over the monthly allowance for ${consecutiveOver} months in a row.`,
          details: { metric, periodStart, used, allowance, consecutiveOver },
        });
    }
  };

  private measure = async (
    account: allowanceRepository.AllowanceAccountRow,
    config: BillingConfig,
    monthStart: string,
    until: string,
  ): Promise<Record<AllowanceMetric, { allowance: number; used: number }>> => {
    const [averageActiveMachines, techUsers, use] = await Promise.all([
      allowanceRepository.findAverageActiveMachines(
        this.serviceDatabase,
        account.id,
        monthStart,
        until,
      ),
      allowanceRepository.countTechUsers(
        this.serviceDatabase,
        account.id,
        monthStart,
      ),
      allowanceRepository.measureUse(this.serviceDatabase, {
        billingAccountId: account.id,
        timezone: account.timezone,
        monthStart,
        until,
      }),
    ]);
    const inputs = { averageActiveMachines, techUsers, config };
    return Object.fromEntries(
      ALLOWANCE_METRICS.map((metric) => [
        metric,
        { allowance: calculateAllowance(metric, inputs), used: use[metric] },
      ]),
    ) as Record<AllowanceMetric, { allowance: number; used: number }>;
  };

  private announce = async (
    billingAccountId: string,
    metric: AllowanceMetric,
    state: ThresholdState,
    ratio: number,
  ) => {
    const name = METRIC_NAMES[metric];
    const notice = {
      title:
        state === 'flagged'
          ? `${name} allowance reached`
          : `${name} at ${formatRatio(ratio)} of allowance`,
      body:
        state === 'flagged'
          ? `${name} use has reached ${formatRatio(ratio)} of this month's allowance. Nothing is blocked or charged; QuipTech may contact you about a plan that fits your use.`
          : `${name} use is at ${formatRatio(ratio)} of this month's allowance. Nothing is blocked or charged.`,
      link: '/settings/billing',
    };
    await this.notifier.notifyAccountAdmins(billingAccountId, notice);
    if (state === 'flagged')
      await this.notifier.notifyPlatformAdmins({
        ...notice,
        body: `An account's ${name.toLowerCase()} use reached ${formatRatio(ratio)} of its monthly allowance and is flagged.`,
        link: '/admin/billing-accounts',
      });
  };

  private raiseTask = (
    billingAccountId: string,
    type: 'plan_review' | 'abuse_flag',
    params: { reason: string; details: Record<string, unknown> },
  ) =>
    this.serviceDatabase.transaction((client) =>
      this.reviewTasks.raiseOnce(client, null, {
        billingAccountId,
        type,
        reason: params.reason,
        details: params.details,
      }),
    );
}

const formatRatio = (ratio: number) =>
  Number.isFinite(ratio) ? `${Math.round(ratio * 100)}%` : 'over 100%';
