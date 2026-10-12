import { Card } from "@/components/ui/card";
import { formatDayMonth } from "@/lib/format/elapsedTimeLabel";
import type { FleetUptime } from "@/lib/types/dashboard";

// Below this a week's bar turns red.
const LOW_UPTIME_PERCENT = 60;

const toDate = (isoDay: string) => new Date(`${isoDay}T00:00:00Z`);

// Weekly share of machine-time not spent "down", from the status changes
// recorded since tracking began. Weeks before that show an empty slot.
export const FleetUptimeCard = ({ uptime }: { uptime: FleetUptime }) => {
  const caption =
    uptime.averagePercent !== null
      ? `Avg ${uptime.averagePercent}%`
      : uptime.trackingSince
        ? `Tracking since ${formatDayMonth(new Date(uptime.trackingSince))}`
        : "No machines tracked yet";

  return (
    <Card className="flex-1 gap-2.5">
      <div className="flex items-baseline">
        <h2 className="text-base font-medium text-ink">Fleet uptime, last {uptime.weeks.length} weeks</h2>
        <span className="ml-auto text-xs text-mutedGray">{caption}</span>
      </div>
      <div className="flex h-[84px] flex-1 items-end gap-1.5">
        {uptime.weeks.map((week) =>
          week.uptimePercent === null ? (
            <div
              key={week.weekStart}
              title="Not tracked yet"
              className="h-1 flex-1 rounded-[3px] bg-fillGray"
            />
          ) : (
            <div
              key={week.weekStart}
              title={`Week of ${formatDayMonth(toDate(week.weekStart))}: ${week.uptimePercent}%`}
              style={{ height: `${Math.max(week.uptimePercent, 3)}%` }}
              className={`flex-1 rounded-t-[3px] ${week.uptimePercent < LOW_UPTIME_PERCENT ? "bg-danger" : "bg-primary"}`}
            />
          ),
        )}
      </div>
      <div className="flex gap-1.5">
        {uptime.weeks.map((week) => (
          <span key={week.weekStart} className="flex-1 text-center text-xs text-mutedGray">
            {formatDayMonth(toDate(week.weekStart))}
          </span>
        ))}
      </div>
    </Card>
  );
};
