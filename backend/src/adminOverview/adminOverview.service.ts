import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AdminScope } from '../auth/adminScope/adminScope';
import { AuditLogService } from '../adminAuditLog/auditLog.service';
import { AuditLogEvent } from '../adminAuditLog/types/auditLogResponse';
import * as overviewRepository from './adminOverview.repository';
import {
  toIngestionQueueEntry,
  toOverviewFigures,
} from './adminOverviewMapper';
import {
  AdminOverview,
  IngestionQueueEntry,
} from './types/adminOverviewResponse';

const QUEUE_LIMIT = 6;
const LATEST_ACTIONS_LIMIT = 4;
// Enough recent events to still find a few changes among sign-ins.
const RECENT_EVENTS_SCANNED = 30;

// The admin Overview page in one request, for the caller's AdminScope.
@Injectable()
export class AdminOverviewService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly auditLogService: AuditLogService,
  ) {}

  getOverview = async (scope: AdminScope): Promise<AdminOverview> => {
    const [summary, queue, latestActions, organisationName] = await Promise.all(
      [
        overviewRepository.getOverviewSummary(this.databaseService, scope),
        this.loadIngestionQueue(scope),
        this.loadLatestActions(scope),
        scope.tenantId
          ? overviewRepository.findOrganisationName(
              this.databaseService,
              scope.tenantId,
            )
          : Promise.resolve(null),
      ],
    );
    const { organisationCount, siteCount, ...figures } =
      toOverviewFigures(summary);
    return {
      scope: {
        isPlatform: scope.isPlatform,
        organisationName,
        organisationCount,
        siteCount,
      },
      ...figures,
      ingestionQueue: queue,
      latestActions,
    };
  };

  private loadIngestionQueue = async (
    scope: AdminScope,
  ): Promise<IngestionQueueEntry[]> => {
    const rows = await overviewRepository.listIngestionQueue(
      this.databaseService,
      scope,
      QUEUE_LIMIT,
    );
    return rows
      .map(toIngestionQueueEntry)
      .filter((entry): entry is IngestionQueueEntry => entry !== null);
  };

  // Changes people made, newest first; sign-ins are left out.
  private loadLatestActions = async (
    scope: AdminScope,
  ): Promise<AuditLogEvent[]> => {
    const page = await this.auditLogService.listEvents(scope, {
      page: 1,
      pageSize: RECENT_EVENTS_SCANNED,
    });
    return page.items
      .filter((event) => event.action !== 'login')
      .slice(0, LATEST_ACTIONS_LIMIT);
  };
}
