import {
  DiffField,
  DiffRow,
  FieldChange,
  UnchangedItem,
} from './types/machineConfigurationResponse';
import { SnapshotItemRow } from './types/machineConfigurationRows';

const itemKey = (item: SnapshotItemRow) =>
  `${item.system_name}\u0000${item.component_name}`;

// "S/N 4T-9455 · FW v4.14.0"; "Fitted" when nothing identifying is recorded.
export const describeSnapshotItem = (item: SnapshotItemRow): string =>
  [
    item.serial_number && `S/N ${item.serial_number}`,
    item.firmware_version && `FW ${item.firmware_version}`,
    item.software_version && `SW ${item.software_version}`,
  ]
    .filter(Boolean)
    .join(' · ') || 'Fitted';

const DIFF_FIELDS: {
  field: DiffField;
  column: 'serial_number' | 'firmware_version' | 'software_version';
}[] = [
  { field: 'serialNumber', column: 'serial_number' },
  { field: 'firmwareVersion', column: 'firmware_version' },
  { field: 'softwareVersion', column: 'software_version' },
];

// Fields whose value differs; for an added or removed item that's every
// recorded field (the other side is null).
const toFieldChanges = (
  before: SnapshotItemRow | null,
  after: SnapshotItemRow | null,
): FieldChange[] =>
  DIFF_FIELDS.map(({ field, column }) => ({
    field,
    before: before?.[column] ?? null,
    after: after?.[column] ?? null,
  })).filter((change) => change.before !== change.after);

// Compares two snapshots' items (older first): components that changed,
// were added or removed, and the rest unchanged.
export const diffSnapshotItems = (
  before: SnapshotItemRow[],
  after: SnapshotItemRow[],
): { rows: DiffRow[]; unchanged: UnchangedItem[] } => {
  const beforeByKey = new Map(before.map((item) => [itemKey(item), item]));
  const afterKeys = new Set(after.map(itemKey));
  const rows: DiffRow[] = [];
  const unchanged: UnchangedItem[] = [];

  after.forEach((item) => {
    const previous = beforeByKey.get(itemKey(item));
    const fields = toFieldChanges(previous ?? null, item);
    if (!previous) {
      rows.push({
        kind: 'added',
        systemName: item.system_name,
        componentName: item.component_name,
        before: null,
        after: describeSnapshotItem(item),
        fields,
      });
    } else if (fields.length) {
      rows.push({
        kind: 'changed',
        systemName: item.system_name,
        componentName: item.component_name,
        before: describeSnapshotItem(previous),
        after: describeSnapshotItem(item),
        fields,
      });
    } else {
      unchanged.push({
        componentName: item.component_name,
        value: describeSnapshotItem(item),
      });
    }
  });
  before
    .filter((item) => !afterKeys.has(itemKey(item)))
    .forEach((item) =>
      rows.push({
        kind: 'removed',
        systemName: item.system_name,
        componentName: item.component_name,
        before: describeSnapshotItem(item),
        after: null,
        fields: toFieldChanges(item, null),
      }),
    );

  return { rows, unchanged };
};
