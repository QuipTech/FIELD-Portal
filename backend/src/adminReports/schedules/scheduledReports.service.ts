import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { runAuditedChange } from '../../common/audit/runAuditedChange';
import * as schedulesRepository from './scheduledReports.repository';
import { computeNextRunAt } from './computeNextRunAt';
import { toScheduledReport } from './scheduledReportMapper';
import { EmailService } from '../../email/email.service';
import { ScheduledReportsWorker } from './scheduledReports.worker';
import { ScheduledReportDto } from '../dto/scheduledReportDto';
import {
  ScheduledReport,
  ScheduledReportList,
} from '../types/scheduledReportResponse';

const NOT_FOUND_MESSAGE = 'Scheduled report not found.';
// No unique constraints on schedules, so a conflict can't happen.
const UNUSED_CONFLICT_MESSAGE = 'This scheduled report changed meanwhile.';
const ENTITY_TYPE = 'scheduled_report';

const toTiming = (dto: ScheduledReportDto) => ({
  frequency: dto.frequency,
  dayOfWeek: dto.frequency === 'weekly' ? (dto.dayOfWeek ?? null) : null,
  dayOfMonth: dto.frequency === 'monthly' ? (dto.dayOfMonth ?? null) : null,
  sendHour: dto.sendHour,
  timezone: dto.timezone,
});

// Owner-managed report emails; ScheduledReportsWorker sends them.
@Injectable()
export class ScheduledReportsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly emailService: EmailService,
    private readonly worker: ScheduledReportsWorker,
  ) {}

  listSchedules = async (): Promise<ScheduledReportList> => {
    const rows = await schedulesRepository.listSchedules(this.databaseService);
    return {
      schedules: rows.map(toScheduledReport),
      isEmailConfigured: this.emailService.isConfigured,
    };
  };

  createSchedule = async (
    actor: AuthenticatedUser,
    dto: ScheduledReportDto,
  ): Promise<ScheduledReport> => {
    const nextRunAt = computeNextRunAt(toTiming(dto), new Date());
    const scheduleId = await runAuditedChange(
      this.databaseService,
      actor,
      UNUSED_CONFLICT_MESSAGE,
      async (client) => {
        const id = await schedulesRepository.insertSchedule(client, {
          dto,
          nextRunAt,
          createdBy: actor.userId,
        });
        return {
          result: id,
          audit: {
            action: 'create',
            entityType: ENTITY_TYPE,
            entityId: id,
            metadata: { ...dto },
          },
        };
      },
    );
    return this.getSchedule(scheduleId);
  };

  replaceSchedule = async (
    actor: AuthenticatedUser,
    scheduleId: string,
    dto: ScheduledReportDto,
  ): Promise<ScheduledReport> => {
    const before = await this.getSchedule(scheduleId);
    const nextRunAt = computeNextRunAt(toTiming(dto), new Date());
    await runAuditedChange(
      this.databaseService,
      actor,
      UNUSED_CONFLICT_MESSAGE,
      async (client) => {
        const isUpdated = await schedulesRepository.updateSchedule(client, {
          scheduleId,
          dto,
          nextRunAt,
        });
        if (!isUpdated) throw new NotFoundException(NOT_FOUND_MESSAGE);
        return {
          result: scheduleId,
          audit: {
            action: 'update',
            entityType: ENTITY_TYPE,
            entityId: scheduleId,
            metadata: { before, after: dto },
          },
        };
      },
    );
    return this.getSchedule(scheduleId);
  };

  deleteSchedule = async (
    actor: AuthenticatedUser,
    scheduleId: string,
  ): Promise<void> => {
    const schedule = await this.getSchedule(scheduleId);
    await runAuditedChange(
      this.databaseService,
      actor,
      UNUSED_CONFLICT_MESSAGE,
      async (client) => {
        const isDeleted = await schedulesRepository.softDeleteSchedule(
          client,
          scheduleId,
        );
        if (!isDeleted) throw new NotFoundException(NOT_FOUND_MESSAGE);
        return {
          result: scheduleId,
          audit: {
            action: 'delete',
            entityType: ENTITY_TYPE,
            entityId: scheduleId,
            metadata: { name: schedule.name },
          },
        };
      },
    );
  };

  // Sends straight away, e.g. to check the email setup; the regular
  // schedule carries on afterwards.
  sendNow = async (scheduleId: string): Promise<ScheduledReport> => {
    const isMarked = await schedulesRepository.markScheduleDueNow(
      this.databaseService,
      scheduleId,
    );
    if (!isMarked) throw new NotFoundException(NOT_FOUND_MESSAGE);
    this.worker.requestRun();
    return this.getSchedule(scheduleId);
  };

  private getSchedule = async (
    scheduleId: string,
  ): Promise<ScheduledReport> => {
    const row = await schedulesRepository.findSchedule(
      this.databaseService,
      scheduleId,
    );
    if (!row) throw new NotFoundException(NOT_FOUND_MESSAGE);
    return toScheduledReport(row);
  };
}
