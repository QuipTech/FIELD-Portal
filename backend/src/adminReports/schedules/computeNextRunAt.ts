import { ReportTiming } from './scheduleTypes';

const DAY_MS = 24 * 60 * 60 * 1000;
// A monthly report on the 28th is at most 31 days away; a little margin.
const MAX_DAYS_AHEAD = 40;

interface LocalDate {
  year: number;
  month: number;
  day: number;
}

// The zone's wall-clock date and time at `instant`.
const toZonedParts = (instant: Date, timezone: string) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(instant);
  const read = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);
  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour'),
    minute: read('minute'),
    second: read('second'),
  };
};

// How far the zone is ahead of UTC at `instant`, in ms.
const zoneOffsetMs = (instant: Date, timezone: string): number => {
  const p = toZonedParts(instant, timezone);
  const asUtc = Date.UTC(
    p.year,
    p.month - 1,
    p.day,
    p.hour,
    p.minute,
    p.second,
  );
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
};

// The instant the zone's clock shows `hour`:00 on `date`. Checked twice so
// a daylight-saving change on that day lands on the right side.
const toInstant = (date: LocalDate, hour: number, timezone: string): Date => {
  const wallClock = Date.UTC(date.year, date.month - 1, date.day, hour);
  const firstGuess = wallClock - zoneOffsetMs(new Date(wallClock), timezone);
  return new Date(wallClock - zoneOffsetMs(new Date(firstGuess), timezone));
};

const isSendDay = (date: LocalDate, timing: ReportTiming): boolean => {
  if (timing.frequency === 'weekly') {
    const weekday = new Date(
      Date.UTC(date.year, date.month - 1, date.day),
    ).getUTCDay();
    return (weekday || 7) === timing.dayOfWeek;
  }
  if (timing.frequency === 'monthly') return date.day === timing.dayOfMonth;
  return true;
};

// The first send time strictly after `after`.
export const computeNextRunAt = (timing: ReportTiming, after: Date): Date => {
  const today = toZonedParts(after, timing.timezone);
  const start = Date.UTC(today.year, today.month - 1, today.day);
  for (let offset = 0; offset <= MAX_DAYS_AHEAD; offset += 1) {
    const day = new Date(start + offset * DAY_MS);
    const date = {
      year: day.getUTCFullYear(),
      month: day.getUTCMonth() + 1,
      day: day.getUTCDate(),
    };
    if (!isSendDay(date, timing)) continue;
    const candidate = toInstant(date, timing.sendHour, timing.timezone);
    if (candidate.getTime() > after.getTime()) return candidate;
  }
  throw new Error(`No send time found for ${JSON.stringify(timing)}`);
};
