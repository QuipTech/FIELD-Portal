import { PoolClient, QueryResult, QueryResultRow } from 'pg';
import { SessionState, SessionStatus } from './machineAppEvents';

interface Queryable {
  query: <T extends QueryResultRow>(
    text: string,
    params?: unknown[],
  ) => Promise<QueryResult<T>>;
}

export interface PairedDeviceRow {
  device_id: string;
  machine_id: string;
  tenant_id: string;
  machine_label: string;
}

interface SessionStateRow {
  status: SessionStatus;
  tablet_online: boolean;
  portal_online: boolean;
}

// Null when the token is revoked or the tablet is no longer connected.
export const findDeviceByTokenHash = async (
  db: Queryable,
  tokenHash: string,
): Promise<PairedDeviceRow | null> => {
  const result = await db.query<PairedDeviceRow>(
    'SELECT * FROM mc_device_for_token($1)',
    [tokenHash],
  );
  return result.rows[0] ?? null;
};

// Null when the machine has no live session.
export const findSessionState = async (
  db: Queryable,
  machineId: string,
): Promise<SessionState | null> => {
  const result = await db.query<SessionStateRow>(
    'SELECT status, tablet_online, portal_online FROM mc_session_state($1)',
    [machineId],
  );
  const row = result.rows[0];
  return row
    ? {
        status: row.status,
        tabletOnline: row.tablet_online,
        portalOnline: row.portal_online,
      }
    : null;
};

export const rotateDeviceToken = async (
  client: PoolClient,
  oldHash: string,
  newHash: string,
): Promise<boolean> => {
  const result = await client.query<{ rotated: boolean }>(
    'SELECT mc_rotate_device_token($1, $2) AS rotated',
    [oldHash, newHash],
  );
  return result.rows[0].rotated;
};

export const endDeviceSession = async (
  client: PoolClient,
  tokenHash: string,
): Promise<boolean> => {
  const result = await client.query<{ ended: boolean }>(
    'SELECT mc_end_device_session($1) AS ended',
    [tokenHash],
  );
  return result.rows[0].ended;
};

export const setDeviceOnline = async (
  db: Queryable,
  params: { deviceId: string; socketId: string; online: boolean },
): Promise<void> => {
  await db.query('SELECT mc_set_device_online($1, $2, $3)', [
    params.deviceId,
    params.socketId,
    params.online,
  ]);
};

export const watchMachine = async (
  db: Queryable,
  socketId: string,
  machineId: string,
): Promise<void> => {
  await db.query('SELECT mc_watch_machine($1, $2)', [socketId, machineId]);
};

// machineId null: every machine this socket watches.
export const unwatchMachine = async (
  db: Queryable,
  socketId: string,
  machineId: string | null,
): Promise<void> => {
  await db.query('SELECT mc_unwatch_machine($1, $2)', [socketId, machineId]);
};

export const touchLiveSockets = async (
  db: Queryable,
  deviceIds: string[],
  socketIds: string[],
): Promise<void> => {
  await db.query('SELECT mc_touch_live($1::uuid[], $2::varchar[])', [
    deviceIds,
    socketIds,
  ]);
};

export const sweepSessions = async (
  db: Queryable,
  staleSeconds: number,
  timeoutMinutes: number,
): Promise<number> => {
  const result = await db.query<{ ended: number }>(
    'SELECT mc_sweep_sessions($1, $2) AS ended',
    [staleSeconds, timeoutMinutes],
  );
  return result.rows[0].ended;
};
