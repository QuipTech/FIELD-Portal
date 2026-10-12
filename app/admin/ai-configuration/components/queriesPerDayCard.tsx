import { Card } from "@/components/ui/card";
import { formatShortDate } from "@/lib/format/shortDate";
import type { AiUsageOverview } from "@/lib/types/aiConfiguration";

type QueriesPerDayCardProps = Pick<AiUsageOverview, "queriesPerDay" | "averageQueriesPerDay">;

export const QueriesPerDayCard = ({ queriesPerDay, averageQueriesPerDay }: QueriesPerDayCardProps) => {
  const busiestDay = Math.max(1, ...queriesPerDay.map((day) => day.count));

  return (
    <Card className="gap-2.5">
      <div className="flex items-baseline">
        <h2 className="text-base font-medium text-ink">Queries per day</h2>
        <span className="ml-auto text-xs text-mutedGray">Avg {averageQueriesPerDay.toLocaleString("en-AU")}/day</span>
      </div>
      <div className="flex h-[84px] flex-1 items-end gap-1">
        {queriesPerDay.map((day) => (
          <div
            key={day.date}
            title={`${formatShortDate(day.date)}: ${day.count.toLocaleString("en-AU")} queries`}
            style={{ height: `${Math.max(2, (day.count / busiestDay) * 100)}%` }}
            className={`flex-1 rounded-t-[3px] ${day.count ? "bg-primary" : "bg-fillGray"}`}
          />
        ))}
      </div>
    </Card>
  );
};
