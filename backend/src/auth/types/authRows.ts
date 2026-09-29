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
  // Profile photo URL (from Google sign-in); null when there is none.
  avatar_url: string | null;
  // S3 key of an uploaded avatar; takes precedence over avatar_url.
  avatar_storage_key: string | null;
}

export interface UserLoginRow {
  id: string;
  tenant_id: string;
  // Null for users who only ever signed up through Google/Apple.
  password_hash: string | null;
  status: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  // S3 key of an uploaded avatar; takes precedence over avatar_url.
  avatar_storage_key: string | null;
  tenant_status: string;
}

export interface SessionRow {
  id: string;
  tenant_id: string;
  user_id: string;
  refresh_token_hash: string;
  expires_at: string;
}
