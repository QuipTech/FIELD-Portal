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
  | 'baseline'
  // Restoring a snapshot (0104): the configuration it replaced, and after.
  | 'before_restore'
  | 'restored';

export interface Snapshot {
  id: string;
  takenAt: string;
  // Null when the system took it.
  takenBy: { id: string; name: string; avatarUrl: string | null } | null;
  trigger: SnapshotTrigger;
  isKnownGood: boolean;
}

export type DiffChangeKind = 'changed' | 'added' | 'removed';

export type DiffField = 'serialNumber' | 'firmwareVersion' | 'softwareVersion';

// One field of one component, before → after (null = not recorded).
export interface FieldChange {
  field: DiffField;
  before: string | null;
  after: string | null;
}

export interface DiffRow {
  kind: DiffChangeKind;
  systemName: string;
  componentName: string;
  // The whole item as text, e.g. "S/N 4T-9455 · FW v4.14.0".
  before: string | null;
  after: string | null;
  // Field by field: what changed, or every recorded field when added/removed.
  fields: FieldChange[];
}

export interface UnchangedItem {
  componentName: string;
  value: string;
}

export interface ComponentRef {
  systemName: string;
  componentName: string;
}

// POST /machines/:machineId/snapshots/:snapshotId/restore
export interface SnapshotRestore {
  restoredFrom: Snapshot;
  // The configuration before and after the restore, as new snapshots.
  before: Snapshot;
  after: Snapshot;
  // Components whose serial / firmware / software changed.
  updatedComponents: number;
  // In the snapshot but no longer installed (not re-added).
  missingComponents: ComponentRef[];
  // Installed now but not in the snapshot (left as they are).
  extraComponents: ComponentRef[];
}

export interface SnapshotDiff {
  from: Snapshot;
  to: Snapshot;
  rows: DiffRow[];
  unchanged: UnchangedItem[];
}
