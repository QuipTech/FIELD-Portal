import { Card } from "@/components/ui/card";
import { queriesPerDay } from "@/lib/mockData/aiConfiguration";

export const QueriesPerDayCard = () => {
  return (
    <Card className="gap-2.5">
      <div className="flex items-baseline">
        <h2 className="text-base font-medium text-ink">Queries per day</h2>
        <span className="ml-auto text-xs text-mutedGray">Avg 608/day</span>
      </div>
      <div className="flex h-[84px] flex-1 items-end gap-1.5">
        {queriesPerDay.map((height, index) => (
          <div key={index} style={{ height: `${height}%` }} className="flex-1 rounded-t-[3px] bg-primary" />
        ))}
      </div>
    </Card>
  );
};
