import { toCsvText } from '../common/utils/toCsvText';
import { linesToPdf } from '../common/utils/linesToPdf';
import { toPersonName } from './machineHistoryMapper';
import { HistoryEntryRow } from './types/machineHistoryRows';

const EMPTY = '—';

const formatTime = (date: Date) =>
  date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  });

const toComponentText = (row: HistoryEntryRow): string =>
  row.component_name
    ? [row.system_name, row.component_name].filter(Boolean).join(' › ')
    : EMPTY;

const toAuthorText = (row: HistoryEntryRow): string =>
  row.author_id
    ? toPersonName(row.author_first_name, row.author_last_name)
    : 'Deleted user';

// Newest first, like the History tab. Times are UTC.
export const toHistoryCsv = (rows: HistoryEntryRow[]): string =>
  toCsvText([
    [
      'Date (UTC)',
      'Type',
      'Author',
      'Component',
      'Operating hours',
      'Downtime hours',
      'Amendment',
      'Photos',
      'Description',
    ],
    ...rows.map((row) => [
      formatTime(row.created_at),
      row.entry_type,
      toAuthorText(row),
      toComponentText(row),
      row.operating_hours === null ? '' : String(row.operating_hours),
      row.downtime_hours ?? '',
      row.is_amendment ? 'Yes' : 'No',
      String(row.photos.length),
      row.description,
    ]),
  ]);

const toEntryLines = (row: HistoryEntryRow): string[] => [
  `${formatTime(row.created_at)} · ${row.entry_type}${row.is_amendment ? ' (amendment)' : ''} · ${toAuthorText(row)}`,
  ...(row.component_name ? [`   Component: ${toComponentText(row)}`] : []),
  ...(row.operating_hours === null
    ? []
    : [`   Operating hours: ${row.operating_hours}`]),
  ...row.description.split('\n').map((line) => `   ${line}`),
  '',
];

export const toHistoryPdf = (
  rows: HistoryEntryRow[],
  machineLabel: string,
): Promise<Uint8Array> =>
  linesToPdf([
    `${machineLabel} — technical history`,
    `${rows.length} entries · exported ${formatTime(new Date())} UTC`,
    '',
    ...rows.flatMap(toEntryLines),
  ]);
