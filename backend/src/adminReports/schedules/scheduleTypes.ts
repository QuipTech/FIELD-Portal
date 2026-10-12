export const REPORT_FREQUENCIES = ['daily', 'weekly', 'monthly'] as const;

export type ReportFrequency = (typeof REPORT_FREQUENCIES)[number];

// When a report goes out, in its own time zone.
export interface ReportTiming {
  frequency: ReportFrequency;
  // ISO weekday, 1 = Monday. Weekly only.
  dayOfWeek: number | null;
  // 1–28. Monthly only.
  dayOfMonth: number | null;
  sendHour: number;
  // IANA zone, e.g. Australia/Perth.
  timezone: string;
}
