import { PoolClient } from 'pg';
import { DatabaseService } from '../../database/database.service';
import { ScheduledReportRow } from '../types/reportRows';
import { ScheduledReportDto } from '../dto/scheduledReportDto';

// is_sending uses the database clock, so the portal never has to compare
// its own clock with next_run_at.
const COLUMNS = `id, name, report_type, frequency, day_of_week, day_of_month,
  send_hour, timezone, recipients, format, next_run_at, last_sent_at,
  last_status, last_error,
  (next_run_at <= now() OR claimed_at IS NOT NULL) AS is_sending`;

// The DTO's fields in column order ($2–$9 of insert and update).
const toScheduleValues = (dto: ScheduledReportDto, nextRunAt: Date) => [
  dto.name,
  dto.reportType,
  dto.frequency,
  dto.frequency === 'weekly' ? dto.dayOfWeek : null,
  dto.frequency === 'monthly' ? dto.dayOfMonth : null,
  dto.sendHour,
  dto.timezone,
  dto.recipients,
  nextRunAt,
];

export const listSchedules = async (
  databaseService: DatabaseService,
): Promise<ScheduledReportRow[]> => {
  const result = await databaseService.query<ScheduledReportRow>(
    `SELECT ${COLUMNS} FROM scheduled_reports
     WHERE deleted_at IS NULL ORDER BY created_at`,
  );
  return result.rows;
};

export const findSchedule = async (
  databaseService: DatabaseService,
  scheduleId: string,
): Promise<ScheduledReportRow | undefined> => {
  const result = await databaseService.query<ScheduledReportRow>(
    `SELECT ${COLUMNS} FROM scheduled_reports
     WHERE id = $1 AND deleted_at IS NULL`,
    [scheduleId],
  );
  return result.rows[0];
};

export const insertSchedule = async (
  client: PoolClient,
  params: { dto: ScheduledReportDto; nextRunAt: Date; createdBy: string },
): Promise<string> => {
  const result = await client.query<{ id: string }>(
    `INSERT INTO scheduled_reports (created_by, name, report_type, frequency,
       day_of_week, day_of_month, send_hour, timezone, recipients, next_run_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id`,
    [params.createdBy, ...toScheduleValues(params.dto, params.nextRunAt)],
  );
  return result.rows[0].id;
};

// False when there's no such live schedule.
export const updateSchedule = async (
  client: PoolClient,
  params: { scheduleId: string; dto: ScheduledReportDto; nextRunAt: Date },
): Promise<boolean> => {
  const result = await client.query(
    `UPDATE scheduled_reports
     SET name = $2, report_type = $3, frequency = $4, day_of_week = $5,
         day_of_month = $6, send_hour = $7, timezone = $8, recipients = $9,
         next_run_at = $10, updated_at = now()
     WHERE id = $1 AND deleted_at IS NULL`,
    [params.scheduleId, ...toScheduleValues(params.dto, params.nextRunAt)],
  );
  return (result.rowCount ?? 0) > 0;
};

export const softDeleteSchedule = async (
  client: PoolClient,
  scheduleId: string,
): Promise<boolean> => {
  const result = await client.query(
    `UPDATE scheduled_reports SET deleted_at = now(), updated_at = now()
     WHERE id = $1 AND deleted_at IS NULL`,
    [scheduleId],
  );
  return (result.rowCount ?? 0) > 0;
};

// Picked up by the worker on its next poll.
export const markScheduleDueNow = async (
  databaseService: DatabaseService,
  scheduleId: string,
): Promise<boolean> => {
  const result = await databaseService.query(
    `UPDATE scheduled_reports SET next_run_at = now(), updated_at = now()
     WHERE id = $1 AND deleted_at IS NULL`,
    [scheduleId],
  );
  return (result.rowCount ?? 0) > 0;
};

// One due schedule, claimed so other API instances skip it. A claim
// older than staleMinutes (a crashed worker) is taken over.
export const claimDueSchedule = async (
  databaseService: DatabaseService,
  staleMinutes: number,
): Promise<ScheduledReportRow | undefined> => {
  const result = await databaseService.query<ScheduledReportRow>(
    `UPDATE scheduled_reports SET claimed_at = now()
     WHERE id = (
       SELECT id FROM scheduled_reports
       WHERE deleted_at IS NULL AND next_run_at <= now()
         AND (claimed_at IS NULL OR claimed_at < now() - make_interval(mins => $1))
       ORDER BY next_run_at
       FOR UPDATE SKIP LOCKED
       LIMIT 1
     )
     RETURNING ${COLUMNS}`,
    [staleMinutes],
  );
  return result.rows[0];
};

export const finishScheduleRun = async (
  databaseService: DatabaseService,
  params: {
    scheduleId: string;
    status: 'sent' | 'failed';
    error: string | null;
    nextRunAt: Date;
  },
): Promise<void> => {
  await databaseService.query(
    `UPDATE scheduled_reports
     SET claimed_at = NULL, next_run_at = $2, last_status = $3, last_error = $4,
         last_sent_at = CASE WHEN $3 = 'sent' THEN now() ELSE last_sent_at END
     WHERE id = $1`,
    [params.scheduleId, params.nextRunAt, params.status, params.error],
  );
};
