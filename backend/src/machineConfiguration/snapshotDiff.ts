import {
  DiffRow,
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

const isSameItem = (a: SnapshotItemRow, b: SnapshotItemRow) =>
  a.serial_number === b.serial_number &&
  a.firmware_version === b.firmware_version &&
  a.software_version === b.software_version;

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
    if (!previous) {
      rows.push({ kind: 'added', componentName: item.component_name, before: null, after: describeSnapshotItem(item) });
    } else if (!isSameItem(previous, item)) {
      rows.push({
        kind: 'changed',
        componentName: item.component_name,
        before: describeSnapshotItem(previous),
        after: describeSnapshotItem(item),
      });
    } else {
      unchanged.push({ componentName: item.component_name, value: describeSnapshotItem(item) });
    }
  });
  before
    .filter((item) => !afterKeys.has(itemKey(item)))
    .forEach((item) =>
      rows.push({ kind: 'removed', componentName: item.component_name, before: describeSnapshotItem(item), after: null }),
    );

  return { rows, unchanged };
};
