import { PLATFORM_PERMISSION_CODE } from '../../auth/systemRoleNames';

// Which machines a request may see. The rule lives in the database
// (accessible_machines(), migration 0116) and RLS enforces the
// cross-organisation part (0117); every machine read goes through these
// fragments so nothing re-implements it:
//   * own organisation's machines: every one for 'all' and for admins,
//     only those in assigned groups for 'groups_only'
//   * plus machines of other organisations shared with the person or
//     their organisation through an active group assignment
// It is read on every request, so a revoke applies straight away. It needs
// app.user_id, so callers run under DatabaseService.withActor.
//   * 'accessible': the signed-in person's machines
//   * 'all': every machine of the organisation in app.tenant_id, for
//     QuipTech staff and background jobs acting on one organisation

export type MachineScope = 'accessible' | 'all';
export const ACCESSIBLE_MACHINES: MachineScope = 'accessible';
export const ALL_MACHINES: MachineScope = 'all';

export const MACHINE_ACCESS_MODES = ['all', 'groups_only'] as const;
export type MachineAccessMode = (typeof MACHINE_ACCESS_MODES)[number];

export const ORGANISATION_ADMIN_PERMISSION = 'admin.manage_users';

// Admins always see their organisation's machines, so they can't be
// limited to groups.
export const isMachineAccessAdmin = (permissions: string[]): boolean =>
  permissions.includes(ORGANISATION_ADMIN_PERMISSION) ||
  permissions.includes(PLATFORM_PERMISSION_CODE);

const ACCESSIBLE_IDS_SQL = 'SELECT machine_id FROM accessible_machines()';

// Machine `alias` is visible: the organisation's own (`tenantParam`, the
// caller's) that they may see, plus machines shared with them.
export const visibleMachineSql = (
  alias: string,
  tenantParam: string,
  scope: MachineScope,
): string =>
  scope === 'all'
    ? `${alias}.tenant_id = ${tenantParam}`
    : `${alias}.id IN (${ACCESSIBLE_IDS_SQL}
        WHERE tenant_id = ${tenantParam} OR is_shared)`;

// Machine `alias` belongs to the organisation and is visible: for changes
// only the owning organisation makes (status, lifecycle, transfers).
export const ownMachineSql = (
  alias: string,
  tenantParam: string,
  scope: MachineScope,
): string =>
  scope === 'all'
    ? `${alias}.tenant_id = ${tenantParam}`
    : `${alias}.tenant_id = ${tenantParam} AND ${alias}.id IN (${ACCESSIBLE_IDS_SQL})`;

// A row with an optional machine (e.g. a support case): the
// organisation's rows about no machine, and rows about a visible machine
// (RLS limits shared ones further, e.g. cases to the reader's own).
export const linkedMachineVisibleSql = (
  machineIdColumn: string,
  tenantIdColumn: string,
  tenantParam: string,
  scope: MachineScope,
): string =>
  scope === 'all'
    ? `${tenantIdColumn} = ${tenantParam}`
    : `((${tenantIdColumn} = ${tenantParam} AND ${machineIdColumn} IS NULL)
        OR ${machineIdColumn} IN (${ACCESSIBLE_IDS_SQL}))`;
