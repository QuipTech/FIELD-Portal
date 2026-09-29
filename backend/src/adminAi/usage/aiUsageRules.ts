import {
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

export const toUsageOverview = (
  days: number,
  summary: UsageSummaryRow,
  perDay: QueriesPerDayRow[],
  byOrganisation: UsageByOrganisationRow[],
): AiUsageOverview => {
  const totalQueries = Number(summary.total_queries);
  const priorPeriodQueries = Number(summary.prior_queries);
  const totalCost = Number(summary.total_cost);
  return {
    periodDays: days,
    totalQueries,
    priorPeriodQueries,
    changePercent: calculateChangePercent(totalQueries, priorPeriodQueries),
    activeUsers: Number(summary.active_users),
    totalUsers: Number(summary.total_users),
    totalCost: roundTo(totalCost, 2),
    avgCostPerQuery: totalQueries ? roundTo(totalCost / totalQueries, 4) : 0,
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
  };
};
