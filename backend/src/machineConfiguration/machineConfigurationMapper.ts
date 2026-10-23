import {
  ComponentCondition,
  ConditionSeverity,
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

const SEVERITY_BY_CONDITION: Record<ComponentCondition, ConditionSeverity> = {
  ok: 'ok',
  worn: 'warning',
  service_due: 'warning',
  fault: 'critical',
};

const SEVERITIES: ConditionSeverity[] = ['ok', 'warning', 'critical'];

const toIsoOrNull = (date: Date | null) => (date ? new Date(date).toISOString() : null);

const toHoursSinceInstall = (row: ComponentRow): number | null =>
  row.machine_operating_hours === null || row.hours_at_install === null
    ? null
    : Math.max(0, row.machine_operating_hours - row.hours_at_install);

const describeFitted = (row: ComponentRow) =>
  [row.serial_number && `S/N ${row.serial_number}`, row.firmware_version && `FW ${row.firmware_version}`]
    .filter(Boolean)
    .join(' · ') || 'No history recorded';

export const toMachineComponent = (row: ComponentRow): MachineComponent => {
  const outcome = row.last_entry_type ? ENTRY_OUTCOMES[row.last_entry_type] : undefined;
  const condition = outcome?.condition ?? null;
  const setSeverity = SEVERITIES.find((severity) => severity === row.condition_severity);
  return {
    id: row.id,
    systemId: row.system_id,
    systemName: row.system_name,
    name: row.name,
    condition,
    caption: outcome && row.last_entry_at ? `${outcome.verb} ${formatDay(row.last_entry_at)}` : describeFitted(row),
    partNumber: row.part_number,
    serialNumber: row.serial_number,
    manufacturer: row.manufacturer,
    conditionNote: row.condition_note,
    conditionSeverity: setSeverity ?? (condition ? SEVERITY_BY_CONDITION[condition] : null),
    installedAt: toIsoOrNull(row.installed_at),
    hoursAtInstall: row.hours_at_install,
    hoursSinceInstall: toHoursSinceInstall(row),
    lastServicedAt: toIsoOrNull(row.last_serviced_at),
    nextServiceDueHours: row.next_service_due_hours,
    notes: row.notes,
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
