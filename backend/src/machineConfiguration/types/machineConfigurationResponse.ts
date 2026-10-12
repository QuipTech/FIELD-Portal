export interface MachineSystem {
  id: string;
  name: string;
}

// Derived from the component's latest history entry; null when nothing
// about its condition has been recorded.
export type ComponentCondition = 'ok' | 'worn' | 'service_due' | 'fault';

export interface MachineComponent {
  id: string;
  systemId: string;
  systemName: string;
  name: string;
  condition: ComponentCondition | null;
  caption: string;
}

export type SnapshotTrigger =
  | 'manual'
  | 'scheduled'
  | 'service'
  | 'component_replaced'
  | 'baseline';

export interface Snapshot {
  id: string;
  takenAt: string;
  // Null when the system took it.
  takenBy: { id: string; name: string; avatarUrl: string | null } | null;
  trigger: SnapshotTrigger;
  isKnownGood: boolean;
}

export type DiffChangeKind = 'changed' | 'added' | 'removed';

export interface DiffRow {
  kind: DiffChangeKind;
  componentName: string;
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
