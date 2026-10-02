import { FleetUptime, UptimeWeek } from './types/dashboardResponse';

export const UPTIME_WEEKS = 8;

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

export interface StatusEvent {
  machineId: string;
  status: string;
  changedAt: Date;
}

interface Span {
  start: number;
  end: number;
  isDown: boolean;
}

// Monday 00:00 UTC of the week `date` falls in.
export const startOfUtcWeek = (date: Date): Date => {
  const day = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const daysSinceMonday = (day.getUTCDay() + 6) % 7;
  return new Date(day.getTime() - daysSinceMonday * DAY_MS);
};

export const uptimeWindowStart = (now: Date): Date =>
  new Date(startOfUtcWeek(now).getTime() - (UPTIME_WEEKS - 1) * WEEK_MS);

// Each machine's statuses as back-to-back spans. Events before the
// window (each machine's state when it opens) are clamped to its start.
const toSpans = (events: StatusEvent[], windowStart: number, now: number) => {
  const byMachine = new Map<string, StatusEvent[]>();
  events.forEach((event) =>
    byMachine.set(event.machineId, [
      ...(byMachine.get(event.machineId) ?? []),
      event,
    ]),
  );
  return [...byMachine.values()].flatMap((machineEvents): Span[] => {
    const sorted = [...machineEvents].sort(
      (a, b) => a.changedAt.getTime() - b.changedAt.getTime(),
    );
    return sorted.map((event, index) => ({
      start: Math.max(event.changedAt.getTime(), windowStart),
      end: sorted[index + 1]?.changedAt.getTime() ?? now,
      isDown: event.status === 'down',
    }));
  });
};

const overlapMs = (span: Span, from: number, to: number) =>
  Math.max(0, Math.min(span.end, to) - Math.max(span.start, from));

const toPercent = (upMs: number, trackedMs: number): number | null =>
  trackedMs > 0 ? Math.round((upMs / trackedMs) * 1000) / 10 : null;

// Uptime = share of tracked machine-time not spent "down" (service due
// still counts as up). Weeks with no tracked time report null.
export const computeFleetUptime = (
  events: StatusEvent[],
  trackingSince: Date | null,
  now: Date,
): FleetUptime => {
  const windowStart = uptimeWindowStart(now).getTime();
  const spans = toSpans(events, windowStart, now.getTime());
  let totalTracked = 0;
  let totalUp = 0;
  const weeks: UptimeWeek[] = Array.from({ length: UPTIME_WEEKS }, (_, i) => {
    const from = windowStart + i * WEEK_MS;
    const to = Math.min(from + WEEK_MS, now.getTime());
    let tracked = 0;
    let up = 0;
    spans.forEach((span) => {
      const overlap = overlapMs(span, from, to);
      tracked += overlap;
      if (!span.isDown) up += overlap;
    });
    totalTracked += tracked;
    totalUp += up;
    return {
      weekStart: new Date(from).toISOString().slice(0, 10),
      uptimePercent: toPercent(up, tracked),
    };
  });
  return {
    trackingSince: trackingSince?.toISOString() ?? null,
    averagePercent: toPercent(totalUp, totalTracked),
    weeks,
  };
};
