// Rows of the SECURITY DEFINER functions in migration 0042. bigint
// arrives from pg as a string.

export interface AuditLogRow {
  id: string;
  created_at: Date;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  source: string | null;
  actor_id: string | null;
  actor_name: string | null;
  actor_avatar: string | null;
  organisation_name: string;
  // The entity's current name; null once the entity is gone.
  target_name: string | null;
  total_count: string;
}

export interface AuditActorRow {
  id: string;
  name: string;
  organisation_name: string;
}

export interface AuditEventTypeRow {
  entity_type: string;
  action: string;
  event_count: string;
}
