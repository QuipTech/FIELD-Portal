import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ServiceDatabaseService } from '../database/serviceDatabase.service';
import { msUntilNextDailyRun } from './nextDailyRun';

// 17:00 UTC is 03:00–04:00 in eastern Australia, outside site hours.
const DEFAULT_RUN_HOUR_UTC = 17;

// Nightly: deletes AI conversations past each organisation's retention
// period (purge_expired_ai_query_logs, migration 0048). Safe with several
// API instances — the function holds an advisory lock, so only one run
// does the work. Disable with AI_LOG_RETENTION_JOB_ENABLED=false.
@Injectable()
export class AiQueryLogPurgeJob
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(AiQueryLogPurgeJob.name);
  private readonly isEnabled: boolean;
  private readonly runHourUtc: number;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly serviceDatabase: ServiceDatabaseService,
    configService: ConfigService,
  ) {
    this.isEnabled =
      configService.get<string>('AI_LOG_RETENTION_JOB_ENABLED') !== 'false';
    const hour = Number(
      configService.get<string>('AI_LOG_RETENTION_HOUR_UTC') ??
        DEFAULT_RUN_HOUR_UTC,
    );
    this.runHourUtc =
      Number.isInteger(hour) && hour >= 0 && hour <= 23
        ? hour
        : DEFAULT_RUN_HOUR_UTC;
  }

  onApplicationBootstrap = () => {
    if (!this.isEnabled) {
      this.logger.warn(
        'AI query log retention job disabled (AI_LOG_RETENTION_JOB_ENABLED=false).',
      );
      return;
    }
    this.scheduleNextRun();
  };

  onModuleDestroy = () => {
    if (this.timer) clearTimeout(this.timer);
  };

  // Public so it can be run by hand (e.g. from a one-off script).
  runPurge = async (): Promise<void> => {
    const result = await this.serviceDatabase.query<{
      tenant_id: string;
      conversations_deleted: number;
      messages_deleted: number;
    }>('SELECT * FROM purge_expired_ai_query_logs()');
    const conversations = result.rows.reduce(
      (sum, row) => sum + row.conversations_deleted,
      0,
    );
    const messages = result.rows.reduce(
      (sum, row) => sum + row.messages_deleted,
      0,
    );
    this.logger.log(
      `AI query log purge: ${conversations} conversations / ${messages} messages removed across ${result.rows.length} organisations.`,
    );
  };

  private scheduleNextRun = () => {
    this.timer = setTimeout(() => {
      this.runPurge()
        .catch((error: unknown) =>
          this.logger.error(`AI query log purge failed: ${String(error)}`),
        )
        .finally(() => this.scheduleNextRun());
    }, msUntilNextDailyRun(this.runHourUtc));
  };
}
