export interface TenantRow {
  id: string;
  name: string;
  slug: string;
}

export interface UserRow {
  id: string;
  tenant_id: string;
  email: string;
  first_name: string;
  last_name: string;
  status: string;
}

export interface UserLoginRow {
  id: string;
  tenant_id: string;
  password_hash: string;
  status: string;
  first_name: string;
  last_name: string;
  tenant_status: string;
}

export interface SessionRow {
  id: string;
  tenant_id: string;
  user_id: string;
  refresh_token_hash: string;
  expires_at: string;
}
