export type AuditSource = 'web' | 'mobile' | 'system';

export interface AuditLogEvent {
  id: string;
  occurredAt: string;
  // Raw values, for filtering; actionLabel/target are what people read.
  action: string;
  entityType: string;
  entityId: string | null;
  actionLabel: string;
  target: string;
  // null for events recorded before the source was tracked.
  source: AuditSource | null;
  actor: { id: string; name: string; avatarUrl: string | null } | null;
  organisationName: string;
}

export interface AuditLogPage {
  items: AuditLogEvent[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AuditLogFilters {
  actors: { id: string; name: string; organisationName: string }[];
  eventTypes: {
    entityType: string;
    action: string;
    label: string;
    count: number;
  }[];
}
