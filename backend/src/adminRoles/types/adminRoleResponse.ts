export interface AdminRole {
  id: string;
  name: string;
  userCount: number;
  permissionCodes: string[];
  // null for a system role (every organisation); otherwise its own org.
  organisation: { id: string; name: string } | null;
  // Whether the caller may change it: the Owner any role, an organisation
  // admin
  // only their organisation's own roles.
  isEditable: boolean;
  // A default role shipped with the platform (Owner, Customer, Technical
  // Manager, Field Technician, Knowledge Manager): no rename or delete.
  isBuiltIn: boolean;
  // Owner always holds every permission.
  arePermissionsLocked: boolean;
}

export interface AdminPermission {
  code: string;
  label: string;
}
