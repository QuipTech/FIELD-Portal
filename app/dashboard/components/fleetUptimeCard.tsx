import { Card } from "@/components/ui/card";

const weeklyUptime = [72, 84, 60, 90, 78, 95, 52, 88];

export const FleetUptimeCard = () => {
  return (
    <Card className="flex-1 gap-2.5">
      <div className="flex items-baseline">
        <h2 className="text-base font-medium text-ink">Fleet uptime, last 8 weeks</h2>
        <span className="ml-auto text-xs text-mutedGray">Avg 91%</span>
      </div>
      <div className="flex h-[84px] flex-1 items-end gap-1.5">
        {weeklyUptime.map((height, index) => (
          <div
            key={index}
            style={{ height: `${height}%` }}
            className={`flex-1 rounded-t-[3px] ${height < 60 ? "bg-danger" : "bg-primary"}`}
          />
        ))}
      </div>
      <div className="flex justify-between">
        {weeklyUptime.map((_, index) => (
          <span key={index} className="text-xs text-mutedGray">
            W{index + 1}
          </span>
        ))}
      </div>
    </Card>
  );
};
