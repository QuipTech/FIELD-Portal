import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AdminScope } from '../auth/adminScope/adminScope';
import * as auditLogRepository from './auditLog.repository';
import { describeAuditEvent } from './describeAuditEvent';
import { labelEventType } from './auditEventLabels';
import { toAuditLogCsv } from './toAuditLogCsv';
import {
  AuditLogFilterQueryDto,
  ListAuditLogQueryDto,
} from './dto/listAuditLogQueryDto';
import { AuditLogRow } from './types/auditLogRows';
import {
  AuditLogEvent,
  AuditLogFilters,
  AuditLogPage,
  AuditSource,
} from './types/auditLogResponse';

// Keeps one export to a single bounded query; narrow the filters for more.
export const EXPORT_ROW_LIMIT = 20_000;

const toAuditLogEvent = (row: AuditLogRow): AuditLogEvent => ({
  id: row.id,
  occurredAt: row.created_at.toISOString(),
  action: row.action,
  entityType: row.entity_type,
  entityId: row.entity_id,
  ...describeAuditEvent(row),
  source: (row.source as AuditSource | null) ?? null,
  actor: row.actor_id
    ? {
        id: row.actor_id,
        name: row.actor_name ?? 'Deleted user',
        avatarUrl: row.actor_avatar,
      }
    : null,
  organisationName: row.organisation_name,
});

// Audit events newest first: the caller's organisation, or every
// organisation for the Owner (AdminScope).
@Injectable()
export class AuditLogService {
  constructor(private readonly databaseService: DatabaseService) {}

  listEvents = async (
    scope: AdminScope,
    query: ListAuditLogQueryDto,
  ): Promise<AuditLogPage> => {
    const rows = await auditLogRepository.listAuditLogs(
      this.databaseService,
      scope,
      query,
      {
        limit: query.pageSize,
        offset: (query.page - 1) * query.pageSize,
      },
    );
    return {
      items: rows.map(toAuditLogEvent),
      total: Number(rows[0]?.total_count ?? 0),
      page: query.page,
      pageSize: query.pageSize,
    };
  };

  listFilters = async (scope: AdminScope): Promise<AuditLogFilters> => {
    const [actors, eventTypes] = await Promise.all([
      auditLogRepository.listAuditActors(this.databaseService, scope),
      auditLogRepository.listAuditEventTypes(this.databaseService, scope),
    ]);
    return {
      actors: actors.map((row) => ({
        id: row.id,
        name: row.name,
        organisationName: row.organisation_name,
      })),
      eventTypes: eventTypes
        .map((row) => ({
          entityType: row.entity_type,
          action: row.action,
          label: labelEventType(row.entity_type, row.action),
          count: Number(row.event_count),
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    };
  };

  // isTruncated when more events matched than one export holds.
  exportCsv = async (
    scope: AdminScope,
    filters: AuditLogFilterQueryDto,
  ): Promise<{ csv: string; isTruncated: boolean }> => {
    const rows = await auditLogRepository.listAuditLogs(
      this.databaseService,
      scope,
      filters,
      {
        limit: EXPORT_ROW_LIMIT,
        offset: 0,
      },
    );
    return {
      csv: toAuditLogCsv(rows.map(toAuditLogEvent)),
      isTruncated: Number(rows[0]?.total_count ?? 0) > rows.length,
    };
  };
}
