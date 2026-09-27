export interface AdminUserListItem {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  // 'active' | 'invited' | 'disabled', as stored on users.status.
  status: string;
  roles: string[];
  organisation: { id: string; name: string };
  lastActiveAt: string | null;
  createdAt: string;
}

export interface AdminUserListResponse {
  users: AdminUserListItem[];
  total: number;
  page: number;
  pageSize: number;
}
