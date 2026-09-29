import { Injectable, NotFoundException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { runAuditedChange } from '../common/audit/runAuditedChange';
import {
  AI_QUERY_LOG_RETENTION_OPTIONS,
  DATA_SCHEMAS,
  RETENTION_PRINCIPLES,
  VISIBILITY_LABELS,
} from '../dataGovernance/dataSchemas.config';
import { UpdateDataRetentionDto } from './dto/updateDataRetentionDto';

const ORGANISATION_NOT_FOUND_MESSAGE = 'Organisation not found.';

export interface DataRetentionSettings {
  schemas: {
    name: string;
    contents: string;
    visibility: string;
    level: string;
  }[];
  principles: { id: string; icon: string; text: string }[];
  retention: { aiQueryLogsMonths: number; allowedMonths: readonly number[] };
}

// tenants has no RLS: always the actor's own tenant id.
const findRetentionMonths = async (
  client: PoolClient,
  tenantId: string,
): Promise<number | undefined> => {
  const result = await client.query<{ months: number }>(
    `SELECT ai_query_log_retention_months AS months FROM tenants
     WHERE id = $1 AND deleted_at IS NULL`,
    [tenantId],
  );
  return result.rows[0]?.months;
};

// Settings → Data & retention. The schema table and principles come from
// dataSchemas.config.ts; the retention period is the admin's own
// organisation's (the nightly purge applies each organisation's value).
@Injectable()
export class DataRetentionService {
  constructor(private readonly databaseService: DatabaseService) {}

  getSettings = async (
    actor: AuthenticatedUser,
  ): Promise<DataRetentionSettings> => {
    const months = await this.databaseService.withTenant(
      actor.tenantId,
      (client) => findRetentionMonths(client, actor.tenantId),
    );
    if (months === undefined)
      throw new NotFoundException(ORGANISATION_NOT_FOUND_MESSAGE);
    return {
      schemas: DATA_SCHEMAS.map(({ name, contents, level }) => ({
        name,
        contents,
        visibility: VISIBILITY_LABELS[level],
        level,
      })),
      principles: RETENTION_PRINCIPLES,
      retention: {
        aiQueryLogsMonths: months,
        allowedMonths: AI_QUERY_LOG_RETENTION_OPTIONS,
      },
    };
  };

  updateSettings = async (
    actor: AuthenticatedUser,
    dto: UpdateDataRetentionDto,
  ): Promise<DataRetentionSettings> => {
    await runAuditedChange(this.databaseService, actor, '', async (client) => {
      const before = await findRetentionMonths(client, actor.tenantId);
      if (before === undefined)
        throw new NotFoundException(ORGANISATION_NOT_FOUND_MESSAGE);
      await client.query(
        `UPDATE tenants SET ai_query_log_retention_months = $2 WHERE id = $1`,
        [actor.tenantId, dto.aiQueryLogsMonths],
      );
      const audit = {
        action: 'update' as const,
        entityType: 'data_retention',
        entityId: actor.tenantId,
        metadata: {
          name: `AI query logs · ${before} → ${dto.aiQueryLogsMonths} months`,
          before: { aiQueryLogsMonths: before },
          after: { aiQueryLogsMonths: dto.aiQueryLogsMonths },
        },
      };
      return { result: null, audit };
    });
    return this.getSettings(actor);
  };
}
