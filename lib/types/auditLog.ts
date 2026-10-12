export type AuditSource = "web" | "mobile" | "system";

export interface AuditLogEvent {
  id: string;
  occurredAt: string;
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

export interface AuditLogFilterOptions {
  actors: { id: string; name: string; organisationName: string }[];
  eventTypes: { entityType: string; action: string; label: string; count: number }[];
}

// Empty strings mean "no filter". eventType is "<entityType>:<action>";
// from is an ISO timestamp, or null for all time.
export interface AuditLogFilters {
  actorId: string;
  eventType: string;
  from: string | null;
}
