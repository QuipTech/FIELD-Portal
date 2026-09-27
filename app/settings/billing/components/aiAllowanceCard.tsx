import { Card } from "@/components/ui/card";

const usedQueries = 3140;
const totalQueries = 4000;
const usedPercent = Math.round((usedQueries / totalQueries) * 100);

export const AiAllowanceCard = () => {
  return (
    <Card className="gap-2">
      <div className="flex items-baseline">
        <span className="text-[15px] font-medium text-ink">
          {usedQueries.toLocaleString()} / {totalQueries.toLocaleString()} queries this period
        </span>
        <span className="ml-auto text-xs text-mutedGray">Included in Standard</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-fillGray">
        <div style={{ width: `${usedPercent}%` }} className="h-full bg-primary" />
      </div>
      <span className="text-xs text-mutedGray">
        Usage above the included allowance is metered overage on your next invoice — it never blocks the AI
        assistant.
      </span>
    </Card>
  );
};
