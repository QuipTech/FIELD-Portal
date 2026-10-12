import {
  PlatformUsageRow,
  QueriesPerDayRow,
  UsageByOrganisationRow,
  UsageSummaryRow,
} from '../types/adminAiRows';
import { AiUsageOverview } from '../types/adminAiResponse';
import { toIsoDay } from '../../common/utils/toIsoDay';

const roundTo = (value: number, places: number): number =>
  Math.round(value * 10 ** places) / 10 ** places;

export const calculateChangePercent = (
  current: number,
  prior: number,
): number | null =>
  prior === 0 ? null : Math.round(((current - prior) / prior) * 100);

// Costs are fractions of a cent per call (embeddings far less), so they
// keep 6 decimal places; the portal formats them.
const COST_DECIMALS = 6;

const toOtherUsage = (rows: PlatformUsageRow[]) =>
  rows.map((row) => ({
    source: row.source,
    calls: Number(row.call_count),
    tokens: Number(row.input_tokens) + Number(row.output_tokens),
    cost: roundTo(Number(row.total_cost), COST_DECIMALS),
  }));

export const toUsageOverview = (
  days: number,
  rows: {
    summary: UsageSummaryRow;
    perDay: QueriesPerDayRow[];
    byOrganisation: UsageByOrganisationRow[];
    platformUsage: PlatformUsageRow[];
  },
): AiUsageOverview => {
  const { summary, perDay, byOrganisation, platformUsage } = rows;
  const totalQueries = Number(summary.total_queries);
  const priorPeriodQueries = Number(summary.prior_queries);
  const assistantCost = Number(summary.total_cost);
  const otherCost = platformUsage.reduce(
    (sum, row) => sum + Number(row.total_cost),
    0,
  );
  return {
    periodDays: days,
    totalQueries,
    priorPeriodQueries,
    changePercent: calculateChangePercent(totalQueries, priorPeriodQueries),
    activeUsers: Number(summary.active_users),
    totalUsers: Number(summary.total_users),
    totalCost: roundTo(assistantCost + otherCost, COST_DECIMALS),
    assistantCost: roundTo(assistantCost, COST_DECIMALS),
    avgCostPerQuery: totalQueries
      ? roundTo(assistantCost / totalQueries, COST_DECIMALS)
      : 0,
    averageQueriesPerDay: Math.round(totalQueries / days),
    flaggedInPeriod: Number(summary.flagged_in_period),
    unreviewedCount: Number(summary.unreviewed_count),
    queriesPerDay: perDay.map((row) => ({
      date: toIsoDay(row.day),
      count: Number(row.query_count),
    })),
    usageByOrganisation: byOrganisation.map((row) => {
      const queries = Number(row.query_count);
      return {
        organisationId: row.tenant_id,
        name: row.organisation_name,
        queries,
        sharePercent: totalQueries
          ? Math.round((queries / totalQueries) * 100)
          : 0,
      };
    }),
    otherUsage: toOtherUsage(platformUsage),
  };
};
