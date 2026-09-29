import type { AuditLogFilterOptions } from "@/lib/types/auditLog";
import { TIME_RANGES, type TimeRange } from "../useAuditLog";

interface AuditLogFilterBarProps {
  options: AuditLogFilterOptions | null;
  actorId: string;
  onActorChange: (actorId: string) => void;
  eventType: string;
  onEventTypeChange: (eventType: string) => void;
  range: TimeRange;
  onRangeChange: (range: TimeRange) => void;
  total: number | null;
}

const selectClasses = "h-8 rounded-md border border-borderGrayStrong bg-surface px-2 text-xs text-bodyGray";

export const AuditLogFilterBar = ({
  options,
  actorId,
  onActorChange,
  eventType,
  onEventTypeChange,
  range,
  onRangeChange,
  total,
}: AuditLogFilterBarProps) => {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label="Actor"
        value={actorId}
        onChange={(event) => onActorChange(event.target.value)}
        className={selectClasses}
      >
        <option value="">Any actor</option>
        {options?.actors.map((actor) => (
          <option key={actor.id} value={actor.id}>
            {actor.name} · {actor.organisationName}
          </option>
        ))}
      </select>
      <select
        aria-label="Action"
        value={eventType}
        onChange={(event) => onEventTypeChange(event.target.value)}
        className={selectClasses}
      >
        <option value="">Any action</option>
        {options?.eventTypes.map((type) => (
          <option key={`${type.entityType}:${type.action}`} value={`${type.entityType}:${type.action}`}>
            {type.label}
          </option>
        ))}
      </select>
      <select
        aria-label="Time range"
        value={range}
        onChange={(event) => onRangeChange(event.target.value as TimeRange)}
        className={selectClasses}
      >
        {TIME_RANGES.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {total !== null && (
        <span className="ml-auto text-xs text-slate-400">
          {total.toLocaleString("en-AU")} {total === 1 ? "event" : "events"}
        </span>
      )}
    </div>
  );
};
