import { AuditLogEvent } from './types/auditLogResponse';
import { toCsvText } from '../common/utils/toCsvText';

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

export const toAuditLogCsv = (events: AuditLogEvent[]): string =>
  toCsvText([
    CSV_HEADER,
    ...events.map((event) => [
      event.occurredAt,
      event.actor?.name ?? 'System',
      event.organisationName,
      event.actionLabel,
      event.target,
      event.source ? SOURCE_LABELS[event.source] : '',
    ]),
  ]);
