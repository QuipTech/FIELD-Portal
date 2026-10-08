import type { DiffChangeKind, DiffRow, SnapshotDiff, SnapshotTrigger } from "@/lib/types/configurationDiff";
import type { Tone } from "@/components/ui/tone";

export const snapshotTriggerLabels: Record<SnapshotTrigger, string> = {
  manual: "Manual",
  scheduled: "Scheduled",
  service: "Service",
  component_replaced: "Component replaced",
  baseline: "Baseline",
};

export const diffKindMeta: Record<DiffChangeKind, { label: string; tone: Tone; arrowClass: string }> = {
  changed: { label: "Changed", tone: "amber", arrowClass: "stroke-amber" },
  added: { label: "Added", tone: "primary", arrowClass: "stroke-primary" },
  removed: { label: "Removed", tone: "danger", arrowClass: "stroke-danger" },
};

const snapshotDayFormat = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" });
const snapshotTimeFormat = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });

// "06 Mar".
export const formatSnapshotDay = (isoDate: string): string => snapshotDayFormat.format(new Date(isoDate));

// "18 Mar · 14:20".
export const formatSnapshotDateTime = (isoDate: string): string =>
  `${formatSnapshotDay(isoDate)} · ${snapshotTimeFormat.format(new Date(isoDate))}`;

const EMPTY_VALUE = "—";

export const formatDiffValue = (value: string | null): string => value ?? EMPTY_VALUE;

const toCsvCell = (value: string) => `"${value.replace(/"/g, '""')}"`;

export const formatDiffAsCsv = (diff: SnapshotDiff): string => {
  const header = ["Change", "Component", `Before (${formatSnapshotDay(diff.from.takenAt)})`, `After (${formatSnapshotDay(diff.to.takenAt)})`];
  const rows = diff.rows.map((row) => [diffKindMeta[row.kind].label, row.componentName, formatDiffValue(row.before), formatDiffValue(row.after)]);
  const unchanged = diff.unchanged.map((item) => ["Unchanged", item.componentName, item.value, item.value]);
  return [header, ...rows, ...unchanged].map((cells) => cells.map(toCsvCell).join(",")).join("\n");
};

const describeRow = (row: DiffRow) =>
  `- ${diffKindMeta[row.kind].label}: ${row.componentName} (${formatDiffValue(row.before)} → ${formatDiffValue(row.after)})`;

// The question the "Ask AI: what could this cause?" button starts with.
export const buildDiffQuestion = (diff: SnapshotDiff): string =>
  [
    `This machine's configuration changed between ${formatSnapshotDay(diff.from.takenAt)} and ${formatSnapshotDay(diff.to.takenAt)}:`,
    ...diff.rows.map(describeRow),
    "What problems could these changes cause, and what should I check first?",
  ].join("\n");

export const diffExportFileName = (assetId: string, diff: SnapshotDiff, extension: string): string =>
  `${assetId}-config-diff-${diff.from.takenAt.slice(0, 10)}-to-${diff.to.takenAt.slice(0, 10)}.${extension}`;
