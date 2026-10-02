// One row of admin_list_roles() (migration 0057).
export interface AdminRoleRow {
  id: string;
  name: string;
  // NULL for a system role; otherwise the organisation that owns it.
  tenant_id: string | null;
  organisation_name: string | null;
  // Shipped with the platform (0062): can't be renamed or deleted.
  is_default: boolean;
  // bigint arrives from pg as a string.
  user_count: string;
  permission_codes: string[];
}

export interface PermissionRow {
  code: string;
  description: string;
}
