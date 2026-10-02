import { DatabaseService } from '../database/database.service';
import { AdminScope } from '../auth/adminScope/adminScope';
import { AuditLogFilterQueryDto } from './dto/listAuditLogQueryDto';
import {
  AuditActorRow,
  AuditEventTypeRow,
  AuditLogRow,
} from './types/auditLogRows';

// Every function takes the caller's AdminScope: its tenantId (null for the
// Owner) is the functions' p_tenant_id (migration 0056).

export const listAuditLogs = async (
  databaseService: DatabaseService,
  scope: AdminScope,
  filters: AuditLogFilterQueryDto,
  paging: { limit: number; offset: number },
): Promise<AuditLogRow[]> => {
  const result = await databaseService.query<AuditLogRow>(
    `SELECT * FROM admin_list_audit_logs($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      scope.tenantId,
      filters.actorId ?? null,
      filters.entityType ?? null,
      filters.action ?? null,
      filters.from ?? null,
      filters.to ?? null,
      paging.limit,
      paging.offset,
    ],
  );
  return result.rows;
};

export const listAuditActors = async (
  databaseService: DatabaseService,
  scope: AdminScope,
): Promise<AuditActorRow[]> => {
  const result = await databaseService.query<AuditActorRow>(
    `SELECT * FROM admin_list_audit_actors($1)`,
    [scope.tenantId],
  );
  return result.rows;
};

export const listAuditEventTypes = async (
  databaseService: DatabaseService,
  scope: AdminScope,
): Promise<AuditEventTypeRow[]> => {
  const result = await databaseService.query<AuditEventTypeRow>(
    `SELECT * FROM admin_list_audit_event_types($1)`,
    [scope.tenantId],
  );
  return result.rows;
};
