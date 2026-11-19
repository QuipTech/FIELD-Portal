import {
  ConflictException,
  GoneException,
  NotFoundException,
} from '@nestjs/common';
import { QueryResult, QueryResultRow } from 'pg';
import { RemoteSessionRow } from './remoteSession.types';

interface Queryable {
  query: <T extends QueryResultRow>(
    text: string,
    params?: unknown[],
  ) => Promise<QueryResult<T>>;
}

// The database functions (migration 0139) raise these as their message.
const KNOWN_ERRORS: Record<string, () => Error> = {
  remote_tablet_not_paired: () =>
    new ConflictException({
      code: 'remote_tablet_not_paired',
      message: "This machine's tablet isn't paired.",
    }),
  remote_session_busy: () =>
    new ConflictException({
      code: 'remote_session_busy',
      message:
        'This tablet already has a remote session waiting or running. Try again when it ends.',
    }),
  remote_session_not_found: () =>
    new NotFoundException({
      code: 'remote_session_not_found',
      message: 'Remote session not found.',
    }),
  remote_session_expired: () =>
    new GoneException({
      code: 'remote_session_expired',
      message: 'This remote session request has expired.',
    }),
  remote_session_closed: () =>
    new ConflictException({
      code: 'remote_session_closed',
      message: 'This remote session has already been answered or ended.',
    }),
};

const mapError = (error: unknown): never => {
  const message = (error as { message?: string } | null)?.message ?? '';
  const known = KNOWN_ERRORS[message];
  throw known ? known() : error;
};

const one = async (
  client: Queryable,
  sql: string,
  params: unknown[],
): Promise<RemoteSessionRow> => {
  try {
    const { rows } = await client.query<RemoteSessionRow>(sql, params);
    return rows[0];
  } catch (error) {
    return mapError(error);
  }
};

export const requestSession = (
  client: Queryable,
  params: {
    machineId: string;
    control: boolean;
    viewerClientId: string;
    requestSeconds: number;
  },
) =>
  one(client, 'SELECT * FROM mc_remote_request($1, $2, $3, $4)', [
    params.machineId,
    params.control,
    params.viewerClientId,
    params.requestSeconds,
  ]);

export const decide = (
  client: Queryable,
  params: {
    deviceId: string;
    sessionId: string;
    allow: boolean;
    allowControl: boolean;
  },
) =>
  one(client, 'SELECT * FROM mc_remote_decide($1, $2, $3, $4)', [
    params.deviceId,
    params.sessionId,
    params.allow,
    params.allowControl,
  ]);

export const endSession = (
  client: Queryable,
  params: {
    sessionId: string;
    reason: string;
    by: 'portal' | 'tablet' | 'system';
    deviceId: string | null;
  },
) =>
  one(client, 'SELECT * FROM mc_remote_end($1, $2, $3, $4)', [
    params.sessionId,
    params.reason,
    params.by,
    params.deviceId,
  ]);

export const touch = (
  client: Queryable,
  params: {
    sessionId: string;
    side: 'viewer' | 'tablet';
    interacted: boolean;
    deviceId: string | null;
  },
) =>
  one(client, 'SELECT * FROM mc_remote_touch($1, $2, $3, $4)', [
    params.sessionId,
    params.side,
    params.interacted,
    params.deviceId,
  ]);

// Under RLS: the Portal caller's view of the session on this machine.
export const findForMachine = async (
  client: Queryable,
  machineId: string,
  sessionId: string,
): Promise<RemoteSessionRow | null> => {
  const { rows } = await client.query<RemoteSessionRow>(
    'SELECT * FROM mc_remote_sessions WHERE id = $1 AND machine_id = $2',
    [sessionId, machineId],
  );
  return rows[0] ?? null;
};

// The tablet's open session, or one of its sessions by id.
export const findForDevice = async (
  client: Queryable,
  deviceId: string,
  sessionId: string | null,
): Promise<RemoteSessionRow | null> => {
  const { rows } = await client.query<RemoteSessionRow>(
    'SELECT * FROM mc_remote_for_device($1, $2)',
    [deviceId, sessionId],
  );
  return rows[0] ?? null;
};

export const setChannel = (
  client: Queryable,
  sessionId: string,
  channelArn: string,
) =>
  client.query('SELECT mc_remote_set_channel($1, $2)', [sessionId, channelArn]);

export const channelDeleted = (client: Queryable, sessionId: string) =>
  client.query('SELECT mc_remote_channel_deleted($1)', [sessionId]);

export const recordingStart = (
  client: Queryable,
  sessionId: string,
  key: string,
  uploadId: string,
) =>
  one(client, 'SELECT * FROM mc_remote_recording_start($1, $2, $3)', [
    sessionId,
    key,
    uploadId,
  ]);

export const recordingPart = (
  client: Queryable,
  sessionId: string,
  part: number,
  etag: string,
  bytes: number,
) =>
  client.query('SELECT mc_remote_recording_part($1, $2, $3, $4)', [
    sessionId,
    part,
    etag,
    bytes,
  ]);

export const recordingFinish = (
  client: Queryable,
  sessionId: string,
  status: 'completed' | 'failed',
  error: string | null,
  transcriptJob: string | null,
) =>
  one(client, 'SELECT * FROM mc_remote_recording_finish($1, $2, $3, $4)', [
    sessionId,
    status,
    error,
    transcriptJob,
  ]);

export const transcriptFinish = (
  client: Queryable,
  sessionId: string,
  status: 'completed' | 'failed',
  text: string | null,
  error: string | null,
) =>
  client.query('SELECT mc_remote_transcript_finish($1, $2, $3, $4)', [
    sessionId,
    status,
    text,
    error,
  ]);

export const sweep = async (
  client: Queryable,
  inactiveMinutes: number,
  lostSeconds: number,
  maxMinutes: number,
): Promise<number> => {
  const { rows } = await client.query<{ closed: number }>(
    'SELECT mc_remote_sweep($1, $2, $3) AS closed',
    [inactiveMinutes, lostSeconds, maxMinutes],
  );
  return rows[0]?.closed ?? 0;
};

export const pendingWork = async (
  client: Queryable,
  graceSeconds: number,
): Promise<RemoteSessionRow[]> => {
  const { rows } = await client.query<RemoteSessionRow>(
    'SELECT * FROM mc_remote_pending_work($1)',
    [graceSeconds],
  );
  return rows;
};

export const requestHelp = (
  client: Queryable,
  deviceId: string,
  requestId: string,
  control: boolean,
  viewerClientId: string,
) =>
  one(client, 'SELECT * FROM mc_remote_request_help($1, $2, $3, $4)', [
    deviceId,
    requestId,
    control,
    viewerClientId,
  ]);

export const claimHelp = (client: Queryable, machineId: string, sessionId: string) =>
  one(client, 'SELECT * FROM mc_remote_claim_help($1, $2)', [machineId, sessionId]);

export const findPendingHelp = async (client: Queryable, machineId: string) => {
  const { rows } = await client.query<RemoteSessionRow>(
    `SELECT * FROM mc_remote_sessions
     WHERE machine_id = $1 AND initiated_by = 'tablet'
       AND status = 'requested' AND expires_at > now()
     ORDER BY created_at DESC LIMIT 1`,
    [machineId],
  );
  return rows[0] ?? null;
};
