import type { HistoryDateRange } from "@/lib/types/historyEntry";

const DAY_MS = 86_400_000;
const RANGE_DAYS: Record<Exclude<HistoryDateRange, "all">, number> = { "30d": 30, "90d": 90, "365d": 365 };

// The ISO start of a date range filter, or null for "all time".
export const toRangeStart = (range: HistoryDateRange, now = new Date()): string | null =>
  range === "all" ? null : new Date(now.getTime() - RANGE_DAYS[range] * DAY_MS).toISOString();
