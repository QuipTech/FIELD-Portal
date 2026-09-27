export interface AdminRole {
  id: string;
  name: string;
  userCount: number;
  permissionCodes: string[];
  // Owner / Customer: the code depends on them, so no rename or delete.
  isBuiltIn: boolean;
  // Owner always holds every permission.
  arePermissionsLocked: boolean;
}

export interface AdminPermission {
  code: string;
  label: string;
}
