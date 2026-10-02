import { StatCard } from "@/components/ui/statCard";
import type { AiUsageOverview } from "@/lib/types/aiConfiguration";
import { formatAiCost } from "@/lib/format/aiCostLabel";

const formatCount = (value: number) => value.toLocaleString("en-AU");

const describeChange = (changePercent: number | null) => {
  if (changePercent === null) return "No queries in the prior period";
  const arrow = changePercent >= 0 ? "↑" : "↓";
  return `${arrow} ${Math.abs(changePercent)}% vs prior period`;
};

export const UsageStatCards = ({ usage }: { usage: AiUsageOverview }) => {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-4">
      <StatCard
        label="Total queries"
        value={formatCount(usage.totalQueries)}
        caption={describeChange(usage.changePercent)}
        icon="activity"
        tone="default"
      />
      <StatCard
        label="Active users"
        value={formatCount(usage.activeUsers)}
        caption={`of ${formatCount(usage.totalUsers)} users on the platform`}
        icon="users"
        tone="default"
      />
      <StatCard
        label="Avg. cost / query"
        value={formatAiCost(usage.avgCostPerQuery)}
        caption={`${formatAiCost(usage.totalCost)} total AI cost this period`}
        icon="card"
        tone="default"
      />
      <StatCard
        label="Flagged for review"
        value={formatCount(usage.unreviewedCount)}
        caption={`of ${formatCount(usage.flaggedInPeriod)} flagged this period`}
        icon="alert"
        tone={usage.unreviewedCount > 0 ? "amber" : "default"}
      />
    </div>
  );
};
