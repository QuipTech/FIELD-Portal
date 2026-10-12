export const REPORT_TYPES = [
  'fleet_uptime',
  'cases_sla',
  'ai_usage',
  'audit_log',
] as const;

export type ReportType = (typeof REPORT_TYPES)[number];

// Every report covers this many days back from when it's built.
export const REPORT_PERIOD_DAYS = 30;

export interface ReportFile {
  fileName: string;
  csv: string;
  // More rows matched than one export holds (audit log only).
  isTruncated: boolean;
}
