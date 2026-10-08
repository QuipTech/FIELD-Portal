import type { MachinePerson } from "./machine";

export type SnapshotTrigger = "manual" | "scheduled" | "service" | "component_replaced" | "baseline";

export interface Snapshot {
  id: string;
  takenAt: string;
  // Null when the system took it (schedule, service, component swap).
  takenBy: MachinePerson | null;
  trigger: SnapshotTrigger;
  // Marked by a technician as a configuration the machine ran well on.
  isKnownGood: boolean;
}

export type DiffChangeKind = "changed" | "added" | "removed";

export interface DiffRow {
  kind: DiffChangeKind;
  componentName: string;
  // Null on the side where the component doesn't exist.
  before: string | null;
  after: string | null;
}

export interface UnchangedItem {
  componentName: string;
  value: string;
}

export interface SnapshotDiff {
  from: Snapshot;
  to: Snapshot;
  rows: DiffRow[];
  unchanged: UnchangedItem[];
}

export type DiffExportFormat = "csv" | "pdf";
