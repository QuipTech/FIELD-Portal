import { HistoryEntry } from '../../machineHistory/types/machineHistoryResponse';

export interface MachineSystem {
  id: string;
  name: string;
}

// Derived from the component's latest history entry; null when nothing
// about its condition has been recorded.
export type ComponentCondition = 'ok' | 'worn' | 'service_due' | 'fault';

export type ConditionSeverity = 'ok' | 'warning' | 'critical';

export interface MachineComponent {
  id: string;
  systemId: string;
  systemName: string;
  name: string;
  condition: ComponentCondition | null;
  caption: string;
  partNumber: string | null;
  serialNumber: string | null;
  manufacturer: string | null;
  // A flagged condition in words, e.g. "Worn" or "Fault code 168-0123".
  conditionNote: string | null;
  // Set on the component, else derived from condition.
  conditionSeverity: ConditionSeverity | null;
  installedAt: string | null;
  hoursAtInstall: number | null;
  // Machine hours now minus hours at install.
  hoursSinceInstall: number | null;
  // The latest service or repair entry logged against the component.
  lastServicedAt: string | null;
  nextServiceDueHours: number | null;
  notes: string | null;
}

// GET /machines/:machineId/components/:componentId
export interface MachineComponentDetail extends MachineComponent {
  // Entries logged against this component, newest first.
  history: HistoryEntry[];
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
