import { toUsageOverview } from './aiUsageRules';
import { PlatformUsageRow, UsageSummaryRow } from '../types/adminAiRows';

const summary: UsageSummaryRow = {
  total_queries: '2',
  prior_queries: '0',
  active_users: '1',
  total_users: '6',
  total_cost: 0.0021,
  flagged_in_period: '2',
  unreviewed_count: '1',
};

const indexingRow: PlatformUsageRow = {
  source: 'indexing',
  call_count: '7',
  input_tokens: '1500',
  output_tokens: '0',
  total_cost: 0.00003,
};

const buildOverview = (platformUsage: PlatformUsageRow[]) =>
  toUsageOverview(30, {
    summary,
    perDay: [],
    byOrganisation: [],
    platformUsage,
  });

describe('toUsageOverview', () => {
  it('keeps fractions of a cent instead of rounding the total to $0', () => {
    expect(buildOverview([]).totalCost).toBe(0.0021);
  });

  it('adds other Bedrock usage to the total but not to the per-query average', () => {
    const overview = buildOverview([indexingRow]);
    expect(overview.totalCost).toBe(0.00213);
    expect(overview.assistantCost).toBe(0.0021);
    expect(overview.avgCostPerQuery).toBe(0.00105);
    expect(overview.otherUsage).toEqual([
      { source: 'indexing', calls: 7, tokens: 1500, cost: 0.00003 },
    ]);
  });
});
