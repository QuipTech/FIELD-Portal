import { toCsvText } from '../../common/utils/toCsvText';
import { CasePriority } from '../../dashboard/types/dashboardResponse';
import {
  AiUsageReportRow,
  CaseReportRow,
  FleetUptimeRow,
} from '../types/reportRows';
import { describeCaseSla } from './describeCaseSla';

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  in_progress: 'In progress',
  resolved: 'Resolved',
};

const formatHours = (hours: number) => (Math.round(hours * 10) / 10).toString();
// Costs are fractions of a cent per call, so keep 6 decimal places.
const formatUsd = (value: number) => Number(value).toFixed(6);

export const toFleetUptimeCsv = (rows: FleetUptimeRow[]): string =>
  toCsvText([
    [
      'Organisation',
      'Site',
      'Machines',
      'Tracked hours',
      'Down hours',
      'Uptime %',
    ],
    ...rows.map((row) => {
      const tracked = Number(row.tracked_hours);
      const down = Number(row.down_hours);
      const uptime = tracked > 0 ? ((tracked - down) / tracked) * 100 : null;
      return [
        row.organisation_name,
        row.site,
        row.machine_count,
        formatHours(tracked),
        formatHours(down),
        uptime === null ? '' : uptime.toFixed(1),
      ];
    }),
  ]);

export const toCasesSlaCsv = (
  rows: CaseReportRow[],
  slaHours: Record<CasePriority, number>,
  now: Date,
): string =>
  toCsvText([
    [
      'Case',
      'Organisation',
      'Site',
      'Subject',
      'Priority',
      'Category',
      'Status',
      'Created (UTC)',
      'Resolved (UTC)',
      'Hours open',
      'SLA target (hours)',
      'SLA',
    ],
    ...rows.map((row) => {
      const target = slaHours[row.priority];
      const sla = describeCaseSla(row.created_at, row.resolved_at, target, now);
      return [
        `#${row.case_number}`,
        row.organisation_name,
        row.site ?? '',
        row.subject,
        row.priority,
        row.category,
        STATUS_LABELS[row.status] ?? row.status,
        row.created_at.toISOString(),
        row.resolved_at?.toISOString() ?? '',
        String(sla.hoursOpen),
        String(target),
        sla.status,
      ];
    }),
  ]);

export const toAiUsageCsv = (rows: AiUsageReportRow[]): string =>
  toCsvText([
    [
      'Organisation',
      'Questions',
      'Active users',
      'Answer cost (USD, est.)',
      'Indexing, search & tests cost (USD, est.)',
      'Flagged answers',
    ],
    ...rows.map((row) => [
      row.organisation_name,
      row.query_count,
      row.active_users,
      formatUsd(row.assistant_cost),
      formatUsd(row.other_cost),
      row.flagged_count,
    ]),
  ]);
