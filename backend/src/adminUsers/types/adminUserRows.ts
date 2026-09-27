// One row of admin_list_users() (migration 0028).
export interface AdminUserRow {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  // S3 key of an uploaded avatar; takes precedence over avatar_url.
  avatar_storage_key: string | null;
  status: string;
  last_login_at: Date | null;
  created_at: Date;
  tenant_id: string;
  tenant_name: string;
  roles: string[];
  // bigint arrives from pg as a string.
  total_count: string;
}
