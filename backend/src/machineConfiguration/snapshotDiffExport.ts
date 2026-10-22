import { linesToPdf } from '../common/utils/linesToPdf';
import { toCsvText } from '../common/utils/toCsvText';
import { DiffChangeKind, SnapshotDiff } from './types/machineConfigurationResponse';

const KIND_LABELS: Record<DiffChangeKind, string> = { changed: 'Changed', added: 'Added', removed: 'Removed' };
const EMPTY = '—';

const formatDay = (isoDate: string) =>
  new Date(isoDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });

export const toDiffCsv = (diff: SnapshotDiff): string =>
  toCsvText([
    ['Change', 'Component', `Before (${formatDay(diff.from.takenAt)})`, `After (${formatDay(diff.to.takenAt)})`],
    ...diff.rows.map((row) => [KIND_LABELS[row.kind], row.componentName, row.before ?? EMPTY, row.after ?? EMPTY]),
    ...diff.unchanged.map((item) => ['Unchanged', item.componentName, item.value, item.value]),
  ]);

const toDiffLines = (diff: SnapshotDiff, machineLabel: string): string[] => [
  `${machineLabel} — configuration diff`,
  `${formatDay(diff.from.takenAt)} -> ${formatDay(diff.to.takenAt)} · ${diff.rows.length} changes`,
  '',
  ...diff.rows.map(
    (row) => `${KIND_LABELS[row.kind]}: ${row.componentName}   ${row.before ?? EMPTY} -> ${row.after ?? EMPTY}`,
  ),
  '',
  `Unchanged: ${diff.unchanged.length} other components & settings`,
  ...diff.unchanged.map((item) => `   ${item.componentName}   ${item.value}`),
];

export const toDiffPdf = (diff: SnapshotDiff, machineLabel: string): Promise<Uint8Array> =>
  linesToPdf(toDiffLines(diff, machineLabel));
