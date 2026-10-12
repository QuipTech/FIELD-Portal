import { ScheduledReportRow } from '../types/reportRows';
import { ScheduledReport } from '../types/scheduledReportResponse';
import { ReportTiming } from './scheduleTypes';

export const toScheduledReport = (
  row: ScheduledReportRow,
): ScheduledReport => ({
  id: row.id,
  name: row.name,
  reportType: row.report_type,
  frequency: row.frequency,
  dayOfWeek: row.day_of_week,
  dayOfMonth: row.day_of_month,
  sendHour: row.send_hour,
  timezone: row.timezone,
  recipients: row.recipients,
  format: row.format,
  nextRunAt: row.next_run_at.toISOString(),
  lastSentAt: row.last_sent_at?.toISOString() ?? null,
  lastStatus: row.last_status,
  lastError: row.last_error,
  isSending: row.is_sending,
});

export const toReportTiming = (row: ScheduledReportRow): ReportTiming => ({
  frequency: row.frequency,
  dayOfWeek: row.day_of_week,
  dayOfMonth: row.day_of_month,
  sendHour: row.send_hour,
  timezone: row.timezone,
});
