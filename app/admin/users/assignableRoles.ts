import type { AdminRole } from "@/lib/types/adminRole";

// Roles a person in this organisation can be given: system roles and the
// organisation's own.
export const assignableRoles = (roles: AdminRole[], organisationId: string) =>
  roles.filter((role) => !role.organisation || role.organisation.id === organisationId);

// Owner is the platform administrator: say so wherever it's chosen.
export const describeRoleOption = (role: AdminRole) =>
  role.organisation
    ? `${role.name} (organisation role)`
    : role.name === "Owner"
      ? "Owner — full admin access to every organisation"
      : role.name;

// Organisation admins and the Owner always see every machine, so their
// machine access can't be limited to groups.
export const isMachineAccessAdminRole = (role: AdminRole | undefined) =>
  Boolean(role && (role.arePermissionsLocked || role.permissionCodes.some((code) => code === "admin.manage_users" || code === "platform.manage")));
