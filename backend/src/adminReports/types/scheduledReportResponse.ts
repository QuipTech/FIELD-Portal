import { ReportType } from './reportType';
import { ReportFrequency } from '../schedules/scheduleTypes';

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
  format: 'csv';
  nextRunAt: string;
  lastSentAt: string | null;
  lastStatus: 'sent' | 'failed' | null;
  lastError: string | null;
  // Due or being emailed right now.
  isSending: boolean;
}

export interface ScheduledReportList {
  schedules: ScheduledReport[];
  // False until SES_FROM_EMAIL is set: schedules save but don't send.
  isEmailConfigured: boolean;
}
