import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { ReportsConfig } from '../reportsConfig';
import { ReportBuilderService } from '../reportBuilder.service';
import { EmailService } from '../../email/email.service';
import * as schedulesRepository from './scheduledReports.repository';
import { computeNextRunAt } from './computeNextRunAt';
import { toReportTiming } from './scheduledReportMapper';
import { ScheduledReportRow } from '../types/reportRows';
import { REPORT_PERIOD_DAYS } from '../types/reportType';

const POLL_MS = 60_000;
// A claim this old means the worker that took it stopped mid-send.
const STALE_CLAIM_MINUTES = 15;
const MAX_ERROR_LENGTH = 300;
// Every schedule reports on every organisation (Owner-managed).
const PLATFORM_SCOPE = { tenantId: null, isPlatform: true };

// Emails due scheduled reports, one at a time (claims use SKIP LOCKED, so
// several API instances are safe). A failed send is shown on the schedule
// and not retried until its next run. Polls every minute; requestRun()
// wakes it straight away. Off without SES_FROM_EMAIL, or with
// SCHEDULED_REPORTS_WORKER_ENABLED=false.
@Injectable()
export class ScheduledReportsWorker
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(ScheduledReportsWorker.name);
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private isStopped = false;

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly reportsConfig: ReportsConfig,
    private readonly reportBuilderService: ReportBuilderService,
    private readonly emailService: EmailService,
  ) {}

  onApplicationBootstrap = () => {
    if (
      !this.reportsConfig.isWorkerEnabled ||
      !this.emailService.isConfigured
    ) {
      this.logger.warn(
        'Scheduled reports worker not started (no SES_FROM_EMAIL / AWS_REGION, or SCHEDULED_REPORTS_WORKER_ENABLED=false).',
      );
      this.isStopped = true;
      return;
    }
    this.requestRun();
  };

  onModuleDestroy = () => {
    this.isStopped = true;
    if (this.timer) clearTimeout(this.timer);
  };

  // Called by Send now, so the report doesn't wait for the next poll. A
  // run already in progress claims it before it stops.
  requestRun = (): void => {
    if (this.isStopped || this.isRunning) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    void this.sendDueReports();
  };

  private sendDueReports = async (): Promise<void> => {
    this.isRunning = true;
    try {
      let schedule = await this.claimNext();
      while (schedule && !this.isStopped) {
        await this.sendReport(schedule);
        schedule = await this.claimNext();
      }
    } catch (error) {
      this.logger.error(`Scheduled reports run failed: ${String(error)}`);
    } finally {
      this.isRunning = false;
      if (!this.isStopped) this.timer = setTimeout(this.requestRun, POLL_MS);
    }
  };

  private claimNext = () =>
    schedulesRepository.claimDueSchedule(
      this.databaseService,
      STALE_CLAIM_MINUTES,
    );

  private sendReport = async (schedule: ScheduledReportRow): Promise<void> => {
    const now = new Date();
    let error: string | null = null;
    try {
      const report = await this.reportBuilderService.buildReport(
        PLATFORM_SCOPE,
        schedule.report_type,
        now,
      );
      // One email per recipient, so nobody sees the others' addresses.
      for (const to of schedule.recipients) {
        await this.emailService.sendEmail({
          to,
          subject: `${schedule.name} — ${now.toISOString().slice(0, 10)}`,
          text: `Your scheduled FIELD report "${schedule.name}" is attached. It covers the last ${REPORT_PERIOD_DAYS} days.`,
          attachment: {
            fileName: report.fileName,
            contentType: 'text/csv',
            content: report.csv,
          },
        });
      }
    } catch (sendError) {
      error = String(sendError).slice(0, MAX_ERROR_LENGTH);
      this.logger.warn(`Scheduled report ${schedule.id} failed: ${error}`);
    }
    await schedulesRepository.finishScheduleRun(this.databaseService, {
      scheduleId: schedule.id,
      status: error ? 'failed' : 'sent',
      error,
      nextRunAt: computeNextRunAt(toReportTiming(schedule), now),
    });
  };
}
