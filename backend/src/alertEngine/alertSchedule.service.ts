import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AlertEngineService } from './alertEngine.service';
import { ScheduledTriggerType } from './triggers/scheduledTriggers';

// Uptime reports go out on Monday / the 1st at 8am in this zone.
const UPTIME_TIME_ZONE = 'Australia/Sydney';

// The time-based alert checks. Each job skips a tick while its previous
// run is still going. ALERT_ENGINE_ENABLED=false turns them all off.
// (Cron handlers are methods: @Cron only decorates methods.)
@Injectable()
export class AlertScheduleService {
  private readonly logger = new Logger(AlertScheduleService.name);
  private readonly running = new Set<string>();
  private readonly isEnabled: boolean;

  constructor(
    private readonly alertEngine: AlertEngineService,
    configService: ConfigService,
  ) {
    this.isEnabled =
      configService.get<string>('ALERT_ENGINE_ENABLED') !== 'false';
  }

  // Unactioned cases are measured in minutes, so they're checked often.
  @Cron(CronExpression.EVERY_MINUTE)
  checkUnactionedCases() {
    return this.runOnce('case_unactioned');
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  checkMachines() {
    return Promise.all([
      this.runOnce('machine_down'),
      this.runOnce('service_overdue'),
    ]);
  }

  @Cron('0 8 * * 1', { timeZone: UPTIME_TIME_ZONE })
  checkWeeklyUptime() {
    return this.runOnce('uptime_drop', 'weekly');
  }

  @Cron('0 8 1 * *', { timeZone: UPTIME_TIME_ZONE })
  checkMonthlyUptime() {
    return this.runOnce('uptime_drop', 'monthly');
  }

  private runOnce = async (
    triggerType: ScheduledTriggerType,
    period?: string,
  ): Promise<void> => {
    const jobKey = `${triggerType}:${period ?? ''}`;
    if (!this.isEnabled || this.running.has(jobKey)) return;
    this.running.add(jobKey);
    try {
      await this.alertEngine.runScheduledCheck(
        triggerType,
        period ? (rule) => rule.triggerParams.period === period : undefined,
      );
    } catch (error) {
      this.logger.error(`Alert check ${jobKey} failed: ${String(error)}`);
    } finally {
      this.running.delete(jobKey);
    }
  };
}
