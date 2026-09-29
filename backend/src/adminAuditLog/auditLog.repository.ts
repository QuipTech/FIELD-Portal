import { DatabaseService } from '../database/database.service';
import { AuditLogFilterQueryDto } from './dto/listAuditLogQueryDto';
import {
  AuditActorRow,
  AuditEventTypeRow,
  AuditLogRow,
} from './types/auditLogRows';

export const listAuditLogs = async (
  databaseService: DatabaseService,
  filters: AuditLogFilterQueryDto,
  paging: { limit: number; offset: number },
): Promise<AuditLogRow[]> => {
  const result = await databaseService.query<AuditLogRow>(
    `SELECT * FROM admin_list_audit_logs($1, $2, $3, $4, $5, $6, $7)`,
    [
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
): Promise<AuditActorRow[]> => {
  const result = await databaseService.query<AuditActorRow>(
    `SELECT * FROM admin_list_audit_actors()`,
  );
  return result.rows;
};

export const listAuditEventTypes = async (
  databaseService: DatabaseService,
): Promise<AuditEventTypeRow[]> => {
  const result = await databaseService.query<AuditEventTypeRow>(
    `SELECT * FROM admin_list_audit_event_types()`,
  );
  return result.rows;
};
