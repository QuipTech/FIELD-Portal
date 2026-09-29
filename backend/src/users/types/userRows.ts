export interface UserCognitoLookupRow {
  id: string;
  tenant_id: string;
  email: string;
  status: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  // S3 key of an uploaded avatar; takes precedence over avatar_url.
  avatar_storage_key: string | null;
  tenant_status: string;
}

export interface AccountIdentityRow {
  email: string;
  cognito_sub: string | null;
  avatar_storage_key: string | null;
}
