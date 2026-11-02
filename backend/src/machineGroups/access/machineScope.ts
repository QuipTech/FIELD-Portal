import { PLATFORM_PERMISSION_CODE } from '../../auth/systemRoleNames';

// Which of the organisation's machines a person may see. Every machine
// read goes through this (getAccessibleMachineScope), so the rule lives in
// one place:
//   * organisation admins and the platform administrator: every machine
//   * 'all' (the default): every machine
//   * 'selected': only machines in their groups; ungrouped machines and
//     every other group are hidden, and asking for one is a 404
// It is read on every request, so removing a group applies straight away.

export const MACHINE_ACCESS_MODES = ['all', 'selected'] as const;
export type MachineAccessMode = (typeof MACHINE_ACCESS_MODES)[number];

export const ORGANISATION_ADMIN_PERMISSION = 'admin.manage_users';

export type MachineScope =
  { kind: 'all' } | { kind: 'groups'; groupIds: string[] };

export const ALL_MACHINES: MachineScope = { kind: 'all' };

// Admins always see every machine, so they can't be limited to groups.
export const isMachineAccessAdmin = (permissions: string[]): boolean =>
  permissions.includes(ORGANISATION_ADMIN_PERMISSION) ||
  permissions.includes(PLATFORM_PERMISSION_CODE);

export const resolveMachineScope = (access: {
  isAdmin: boolean;
  mode: MachineAccessMode;
  groupIds: string[];
}): MachineScope =>
  access.isAdmin || access.mode === 'all'
    ? ALL_MACHINES
    : { kind: 'groups', groupIds: access.groupIds };

// The scope as one query parameter: null for every machine, else the
// allowed group ids (possibly none, which matches nothing).
export const toScopeParam = (scope: MachineScope): string[] | null =>
  scope.kind === 'all' ? null : scope.groupIds;

// The WHERE condition for "machine `alias` is in scope", where `param` is
// the placeholder holding toScopeParam(scope). An ungrouped machine's
// group_id is NULL, which never matches a list.
export const machineInScopeSql = (alias: string, param: string): string =>
  `(${param}::uuid[] IS NULL OR ${alias}.group_id = ANY(${param}::uuid[]))`;

// The same for a row that only has a machine id column (e.g. a support
// case's machine_id): rows with no machine stay visible.
export const linkedMachineInScopeSql = (
  machineIdColumn: string,
  tenantIdColumn: string,
  param: string,
): string =>
  `(${param}::uuid[] IS NULL OR ${machineIdColumn} IS NULL OR EXISTS (
     SELECT 1 FROM machines scope_m
     WHERE scope_m.id = ${machineIdColumn} AND scope_m.tenant_id = ${tenantIdColumn}
       AND scope_m.group_id = ANY(${param}::uuid[])))`;
