import { PDFDocument, StandardFonts } from 'pdf-lib';
import { toCsvText } from '../common/utils/toCsvText';
import { DiffChangeKind, SnapshotDiff } from './types/machineConfigurationResponse';

const KIND_LABELS: Record<DiffChangeKind, string> = { changed: 'Changed', added: 'Added', removed: 'Removed' };
const EMPTY = '—';
const PAGE = { width: 595, height: 842, margin: 50, lineHeight: 16, fontSize: 11 };

const formatDay = (isoDate: string) =>
  new Date(isoDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });

export const toDiffCsv = (diff: SnapshotDiff): string =>
  toCsvText([
    ['Change', 'Component', `Before (${formatDay(diff.from.takenAt)})`, `After (${formatDay(diff.to.takenAt)})`],
    ...diff.rows.map((row) => [KIND_LABELS[row.kind], row.componentName, row.before ?? EMPTY, row.after ?? EMPTY]),
    ...diff.unchanged.map((item) => ['Unchanged', item.componentName, item.value, item.value]),
  ]);

// Helvetica only encodes WinAnsi; anything else (→ etc.) is swapped out.
const toWinAnsi = (text: string) =>
  text.replace(/→/g, '->').replace(/[^\x20-\x7E -ÿ—–·›‹‘’“”…]/g, '?');

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

export const toDiffPdf = async (diff: SnapshotDiff, machineLabel: string): Promise<Uint8Array> => {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  const linesPerPage = Math.floor((PAGE.height - 2 * PAGE.margin) / PAGE.lineHeight);
  const lines = toDiffLines(diff, machineLabel);
  for (let start = 0; start < lines.length; start += linesPerPage) {
    const page = document.addPage([PAGE.width, PAGE.height]);
    lines.slice(start, start + linesPerPage).forEach((line, index) =>
      page.drawText(toWinAnsi(line), {
        x: PAGE.margin,
        y: PAGE.height - PAGE.margin - index * PAGE.lineHeight,
        size: PAGE.fontSize,
        font,
        maxWidth: PAGE.width - 2 * PAGE.margin,
      }),
    );
  }
  return document.save();
};
