// One row of admin_list_roles() (migration 0029).
export interface AdminRoleRow {
  id: string;
  name: string;
  // bigint arrives from pg as a string.
  user_count: string;
  permission_codes: string[];
}

export interface PermissionRow {
  code: string;
  description: string;
}
