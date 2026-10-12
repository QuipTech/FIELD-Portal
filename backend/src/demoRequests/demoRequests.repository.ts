import { ServiceDatabaseService } from '../database/serviceDatabase.service';
import { escapeLikePattern } from '../common/utils/escapeLikePattern';
import { DemoRequestListRow, DemoRequestRow } from './types/demoRequestRows';
import { DemoRequestStatus } from './types/demoRequestStatus';
import { ListDemoRequestsQueryDto } from './dto/listDemoRequestsQueryDto';

// platform.demo_requests is service-role only (migration 0066), so every
// query goes through ServiceDatabaseService, never the tenant pool.

const COLUMNS = `id, email, first_name, last_name, company, country, phone,
  message, status, notes, team_email_sent_at, user_email_sent_at,
  ip_address, user_agent, created_at, updated_at`;

export type EmailKind = 'team' | 'user';

const SENT_AT_COLUMN: Record<EmailKind, string> = {
  team: 'team_email_sent_at',
  user: 'user_email_sent_at',
};

export interface NewDemoRequest {
  email: string;
  firstName: string;
  lastName: string;
  company: string;
  country: string;
  phone: string | null;
  message: string | null;
  ipAddress: string | null;
  userAgent: string | null;
}

export const insertDemoRequest = async (
  database: ServiceDatabaseService,
  request: NewDemoRequest,
): Promise<DemoRequestRow> => {
  const result = await database.query<DemoRequestRow>(
    `INSERT INTO platform.demo_requests
       (email, first_name, last_name, company, country, phone, message,
        ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING ${COLUMNS}`,
    [
      request.email,
      request.firstName,
      request.lastName,
      request.company,
      request.country,
      request.phone,
      request.message,
      request.ipAddress,
      request.userAgent,
    ],
  );
  return result.rows[0];
};

export const listDemoRequests = async (
  database: ServiceDatabaseService,
  query: ListDemoRequestsQueryDto,
): Promise<DemoRequestListRow[]> => {
  const search = query.search ? `%${escapeLikePattern(query.search)}%` : null;
  const result = await database.query<DemoRequestListRow>(
    `SELECT ${COLUMNS}, count(*) OVER () AS total_count
     FROM platform.demo_requests
     WHERE ($1::text IS NULL OR status = $1)
       AND ($2::text IS NULL
            OR first_name ILIKE $2 OR last_name ILIKE $2
            OR (first_name || ' ' || last_name) ILIKE $2
            OR email ILIKE $2 OR company ILIKE $2)
     ORDER BY created_at DESC, id
     LIMIT $3 OFFSET $4`,
    [
      query.status ?? null,
      search,
      query.pageSize,
      (query.page - 1) * query.pageSize,
    ],
  );
  return result.rows;
};

export const findDemoRequest = async (
  database: ServiceDatabaseService,
  requestId: string,
): Promise<DemoRequestRow | undefined> => {
  const result = await database.query<DemoRequestRow>(
    `SELECT ${COLUMNS} FROM platform.demo_requests WHERE id = $1`,
    [requestId],
  );
  return result.rows[0];
};

// Only the fields given change; notes '' clears them. undefined when
// there's no such request.
export const updateDemoRequest = async (
  database: ServiceDatabaseService,
  requestId: string,
  changes: { status?: DemoRequestStatus; notes?: string },
): Promise<DemoRequestRow | undefined> => {
  const result = await database.query<DemoRequestRow>(
    `UPDATE platform.demo_requests
     SET status = COALESCE($2::text, status),
         notes = CASE WHEN $3::boolean THEN NULLIF($4::text, '') ELSE notes END,
         updated_at = now()
     WHERE id = $1
     RETURNING ${COLUMNS}`,
    [
      requestId,
      changes.status ?? null,
      changes.notes !== undefined,
      changes.notes ?? null,
    ],
  );
  return result.rows[0];
};

// Records a successful send. Leaves an earlier time in place, so a
// duplicate send never moves it.
export const markEmailSent = async (
  database: ServiceDatabaseService,
  requestId: string,
  kind: EmailKind,
): Promise<void> => {
  const column = SENT_AT_COLUMN[kind];
  await database.query(
    `UPDATE platform.demo_requests
     SET ${column} = COALESCE(${column}, now())
     WHERE id = $1`,
    [requestId],
  );
};
