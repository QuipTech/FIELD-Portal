import type {
  AuditEventDescription,
  AuditEventInput,
} from './describeAuditEvent';

type Metadata = Record<string, unknown>;

const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value ? value : undefined;
const record = (value: unknown): Metadata =>
  value && typeof value === 'object' ? (value as Metadata) : {};
const groupNames = (access: Metadata): string => {
  if (access.machineAccessMode !== 'selected') return 'All machines';
  const groups = Array.isArray(access.groups) ? access.groups : [];
  return groups.map((group) => text(record(group).name) ?? '?').join(', ');
};

// Machine group events (machineGroups module): a group created, renamed or
// deleted, a machine moved between groups, and a person's machine access
// changed. null for every other event.
export const describeMachineGroupEvent = (
  event: AuditEventInput,
  name: string | undefined,
): AuditEventDescription | null => {
  const { entity_type: entityType, action, metadata } = event;
  const before = record(metadata.before);
  const after = record(metadata.after);
  if (
    entityType === 'machine_group' &&
    action === 'update' &&
    metadata.renamed
  ) {
    return {
      actionLabel: 'Renamed machine group',
      target: `${text(before.name) ?? '—'} → ${text(after.name) ?? '—'}`,
    };
  }
  if (entityType === 'machine_group' && action === 'delete') {
    const machines = Array.isArray(metadata.ungroupedMachineIds)
      ? metadata.ungroupedMachineIds.length
      : 0;
    return {
      actionLabel: 'Deleted machine group',
      target: `${name ?? '—'} · ${machines} machines ungrouped`,
    };
  }
  if (entityType === 'machine' && metadata.change === 'group') {
    return {
      actionLabel: 'Moved machine to group',
      target: `${name ?? '—'} · ${text(before.groupName) ?? 'Ungrouped'} → ${text(after.groupName) ?? 'Ungrouped'}`,
    };
  }
  if (entityType === 'user' && metadata.change === 'machine_access') {
    return {
      actionLabel: 'Changed machine access',
      target: `${name ?? '—'} · ${groupNames(before)} → ${groupNames(after)}`,
    };
  }
  return null;
};
