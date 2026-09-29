export interface AdminRole {
  id: string;
  name: string;
  userCount: number;
  permissionCodes: string[];
  // Owner / Customer: can't be renamed or deleted.
  isBuiltIn: boolean;
  // Owner always has every permission.
  arePermissionsLocked: boolean;
}

export interface AdminPermission {
  code: string;
  label: string;
}

export interface CreateRolePayload {
  name: string;
  permissionCodes?: string[];
}

// Either field or both; permissionCodes replaces the whole set.
export interface UpdateRolePayload {
  name?: string;
  permissionCodes?: string[];
}
