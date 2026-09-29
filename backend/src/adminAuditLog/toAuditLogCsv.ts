import { AuditLogEvent } from './types/auditLogResponse';

const CSV_HEADER = [
  'Time (UTC)',
  'Actor',
  'Organisation',
  'Action',
  'Target',
  'Source',
];

const SOURCE_LABELS: Record<string, string> = {
  web: 'Web',
  mobile: 'Mobile',
  system: 'System',
};

// Quotes a cell when needed. A leading =, +, -, @, tab or CR would be run
// as a formula by Excel/Sheets, so such cells are prefixed with ' — the
// log contains user-typed names and titles.
export const toCsvCell = (value: string): string => {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export const toAuditLogCsv = (events: AuditLogEvent[]): string =>
  [
    CSV_HEADER,
    ...events.map((event) => [
      event.occurredAt,
      event.actor?.name ?? 'System',
      event.organisationName,
      event.actionLabel,
      event.target,
      event.source ? SOURCE_LABELS[event.source] : '',
    ]),
  ]
    .map((row) => row.map(toCsvCell).join(','))
    .join('\r\n') + '\r\n';
