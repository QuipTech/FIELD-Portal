import {
  ComponentCondition,
  MachineComponent,
  Snapshot,
  SnapshotTrigger,
} from './types/machineConfigurationResponse';
import { ComponentRow, SnapshotRow } from './types/machineConfigurationRows';

const formatDay = (date: Date) =>
  date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

// What the component's latest history entry says about it.
const ENTRY_OUTCOMES: Record<string, { condition: ComponentCondition | null; verb: string }> = {
  fault: { condition: 'fault', verb: 'Fault logged' },
  repair: { condition: 'ok', verb: 'Repaired' },
  service: { condition: 'ok', verb: 'Serviced' },
  inspection: { condition: 'ok', verb: 'Inspected' },
  note: { condition: null, verb: 'Note added' },
};

const describeFitted = (row: ComponentRow) =>
  [row.serial_number && `S/N ${row.serial_number}`, row.firmware_version && `FW ${row.firmware_version}`]
    .filter(Boolean)
    .join(' · ') || 'No history recorded';

export const toMachineComponent = (row: ComponentRow): MachineComponent => {
  const outcome = row.last_entry_type ? ENTRY_OUTCOMES[row.last_entry_type] : undefined;
  return {
    id: row.id,
    systemId: row.system_id,
    systemName: row.system_name,
    name: row.name,
    condition: outcome?.condition ?? null,
    caption: outcome && row.last_entry_at ? `${outcome.verb} ${formatDay(row.last_entry_at)}` : describeFitted(row),
  };
};

export const toSnapshot = (row: SnapshotRow): Snapshot => ({
  id: row.id,
  takenAt: new Date(row.taken_at).toISOString(),
  takenBy: row.taken_by_id
    ? {
        id: row.taken_by_id,
        name: `${row.taken_by_first_name ?? ''} ${row.taken_by_last_name ?? ''}`.trim(),
        avatarUrl: row.taken_by_avatar_url,
      }
    : null,
  trigger: row.trigger as SnapshotTrigger,
  isKnownGood: row.is_known_good,
});
