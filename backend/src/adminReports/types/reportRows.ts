import { ScheduledReport } from './scheduledReportResponse';

// Rows of the report functions in migration 0064. bigint values arrive
// from pg as strings.

export interface FleetUptimeRow {
  organisation_name: string;
  site: string;
  machine_count: string;
  tracked_hours: number;
  down_hours: number;
}

export interface CaseReportRow {
  case_number: string;
  organisation_name: string;
  site: string | null;
  subject: string;
  priority: 'P1' | 'P2' | 'P3';
  category: string;
  status: string;
  created_at: Date;
  resolved_at: Date | null;
}

export interface AiUsageReportRow {
  organisation_name: string;
  query_count: string;
  active_users: string;
  assistant_cost: number;
  other_cost: number;
  flagged_count: string;
}

export interface ScheduledReportRow {
  id: string;
  name: string;
  report_type: ScheduledReport['reportType'];
  frequency: ScheduledReport['frequency'];
  day_of_week: number | null;
  day_of_month: number | null;
  send_hour: number;
  timezone: string;
  recipients: string[];
  format: 'csv';
  next_run_at: Date;
  last_sent_at: Date | null;
  last_status: 'sent' | 'failed' | null;
  last_error: string | null;
  is_sending: boolean;
}
