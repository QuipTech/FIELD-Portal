export type ReportType = "fleet_uptime" | "cases_sla" | "ai_usage" | "audit_log";

export type ReportFrequency = "daily" | "weekly" | "monthly";

export interface ScheduledReportPayload {
  name: string;
  reportType: ReportType;
  frequency: ReportFrequency;
  // ISO weekday, 1 = Monday. Weekly only.
  dayOfWeek?: number;
  // 1–28. Monthly only.
  dayOfMonth?: number;
  sendHour: number;
  // IANA zone, e.g. Australia/Perth.
  timezone: string;
  recipients: string[];
}

export interface ScheduledReport {
  id: string;
  name: string;
  reportType: ReportType;
  frequency: ReportFrequency;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  sendHour: number;
  timezone: string;
  recipients: string[];
  format: "csv";
  nextRunAt: string;
  lastSentAt: string | null;
  lastStatus: "sent" | "failed" | null;
  lastError: string | null;
  // Due or being emailed right now (the server's clock decides).
  isSending: boolean;
}

export interface ScheduledReportList {
  schedules: ScheduledReport[];
  // False until the server's report email (Amazon SES) is set up.
  isEmailConfigured: boolean;
}
