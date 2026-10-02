"use client";

import { SelectInput } from "@/components/ui/selectInput";
import type { ReportFrequency } from "@/lib/types/adminReports";
import { FREQUENCY_LABELS, formatSendHour, WEEKDAYS } from "../reportCatalog";

export interface ScheduleTiming {
  frequency: ReportFrequency;
  dayOfWeek: number;
  dayOfMonth: number;
  sendHour: number;
}

interface ScheduleTimingFieldsProps {
  timing: ScheduleTiming;
  timezone: string;
  onChange: (timing: ScheduleTiming) => void;
}

const fieldLabelClasses = "text-xs font-medium uppercase tracking-wide text-mutedGray";
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
// Up to the 28th so every month has the day.
const MONTH_DAYS = Array.from({ length: 28 }, (_, index) => index + 1);

export const ScheduleTimingFields = ({ timing, timezone, onChange }: ScheduleTimingFieldsProps) => {
  const update = (changes: Partial<ScheduleTiming>) => onChange({ ...timing, ...changes });

  return (
    <div className="flex flex-col gap-1.5">
      <span className={fieldLabelClasses}>Send</span>
      <div className="grid grid-cols-3 gap-2">
        <SelectInput
          aria-label="Frequency"
          value={timing.frequency}
          onChange={(event) => update({ frequency: event.target.value as ReportFrequency })}
        >
          {Object.entries(FREQUENCY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </SelectInput>
        {timing.frequency === "weekly" && (
          <SelectInput
            aria-label="Day of week"
            value={timing.dayOfWeek}
            onChange={(event) => update({ dayOfWeek: Number(event.target.value) })}
          >
            {WEEKDAYS.map((day, index) => (
              <option key={day} value={index + 1}>
                {day}
              </option>
            ))}
          </SelectInput>
        )}
        {timing.frequency === "monthly" && (
          <SelectInput
            aria-label="Day of month"
            value={timing.dayOfMonth}
            onChange={(event) => update({ dayOfMonth: Number(event.target.value) })}
          >
            {MONTH_DAYS.map((day) => (
              <option key={day} value={day}>
                Day {day}
              </option>
            ))}
          </SelectInput>
        )}
        <SelectInput
          aria-label="Time"
          value={timing.sendHour}
          onChange={(event) => update({ sendHour: Number(event.target.value) })}
          className={timing.frequency === "daily" ? "col-span-2" : ""}
        >
          {HOURS.map((hour) => (
            <option key={hour} value={hour}>
              {formatSendHour(hour)}
            </option>
          ))}
        </SelectInput>
      </div>
      <span className="text-xs text-mutedGray">Times are in {timezone}.</span>
    </div>
  );
};
