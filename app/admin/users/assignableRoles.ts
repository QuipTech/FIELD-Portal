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
