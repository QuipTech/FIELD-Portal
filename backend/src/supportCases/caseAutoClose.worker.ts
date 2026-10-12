import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DatabaseService } from '../database/database.service';
import { findCaseByNumber } from './supportCases.repository';
import { CaseEventsPublisher } from './caseEventsPublisher';
import { REOPEN_WINDOW_DAYS } from './caseAccessPolicy';
import { toSupportCase } from './supportCaseMapper';

const DAY_MS = 24 * 60 * 60 * 1000;

interface ClosedCaseRow {
  closed_tenant_id: string;
  closed_case_number: string;
}

// Closes cases resolved 7+ days ago with no reply since — the same window
// in which a customer may reopen one. The database function writes each
// case's thread line and audit entry (0072). Disable with
// SUPPORT_CASE_AUTO_CLOSE_ENABLED=false.
// (Cron handlers are methods: @Cron only decorates methods.)
@Injectable()
export class CaseAutoCloseWorker {
  private readonly logger = new Logger(CaseAutoCloseWorker.name);
  private readonly isEnabled: boolean;
  private isRunning = false;

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly caseEventsPublisher: CaseEventsPublisher,
    configService: ConfigService,
  ) {
    this.isEnabled =
      configService.get<string>('SUPPORT_CASE_AUTO_CLOSE_ENABLED') !== 'false';
  }

  @Cron(CronExpression.EVERY_HOUR)
  async closeResolvedCases(): Promise<void> {
    if (!this.isEnabled || this.isRunning) return;
    this.isRunning = true;
    try {
      const closed = await this.databaseService.query<ClosedCaseRow>(
        'SELECT * FROM support_close_resolved_cases($1)',
        [new Date(Date.now() - REOPEN_WINDOW_DAYS * DAY_MS)],
      );
      for (const row of closed.rows) {
        await this.announceClosed(
          row.closed_tenant_id,
          Number(row.closed_case_number),
        );
      }
      if (closed.rowCount) {
        this.logger.log(`Closed ${closed.rowCount} resolved support case(s).`);
      }
    } catch (error) {
      this.logger.error(`Auto-closing support cases failed: ${String(error)}`);
    } finally {
      this.isRunning = false;
    }
  }

  private announceClosed = async (
    tenantId: string,
    caseNumber: number,
  ): Promise<void> => {
    const row = await this.databaseService.withTenant(tenantId, (client) =>
      findCaseByNumber(client, tenantId, caseNumber),
    );
    if (row) {
      this.caseEventsPublisher.publishCaseUpdated(tenantId, toSupportCase(row));
    }
  };
}
