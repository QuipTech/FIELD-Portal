export interface AdminRole {
  id: string;
  name: string;
  userCount: number;
  // null when it's shared by every organisation; otherwise the owning org.
  organisation: { id: string; name: string } | null;
  // Whether the signed-in admin may change it (the Owner: anything;
  // an organisation-scoped admin: only their own organisation's).
  isEditable: boolean;
  permissionCodes: string[];
  // A default role shipped with the platform: can't be renamed or deleted.
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
