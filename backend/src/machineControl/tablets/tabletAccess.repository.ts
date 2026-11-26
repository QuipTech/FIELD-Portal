import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PoolClient, QueryResult, QueryResultRow } from 'pg';

interface Queryable {
  query: <T extends QueryResultRow>(
    text: string,
    params?: unknown[],
  ) => Promise<QueryResult<T>>;
}

// One answer for an unknown ID, another organisation's tablet and a wrong
// password, so none of them can be told apart.
export const wrongTabletCredentials = () =>
  new BadRequestException({
    code: 'tablet_credentials_invalid',
    message: "That FIELD ID or password isn't right.",
  });

// The database functions (migration 0143) raise these as their message.
const KNOWN_ERRORS: Record<string, () => Error> = {
  tablet_not_found: wrongTabletCredentials,
  tablet_locked: () =>
    new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        code: 'tablet_locked',
        message:
          'Too many wrong passwords. Try again in 15 minutes, or reset the password.',
      },
      HttpStatus.TOO_MANY_REQUESTS,
    ),
  tablet_assigned: () =>
    new ConflictException({
      code: 'tablet_assigned',
      message:
        'This tablet is already on another machine. Remove it there first.',
    }),
  machine_has_tablet: () =>
    new ConflictException({
      code: 'machine_has_tablet',
      message: 'This machine already has a tablet. Remove it first.',
    }),
  tablet_device_token_invalid: () =>
    new ForbiddenException({
      code: 'tablet_device_token_invalid',
      message: 'That device token no longer works. Register without it.',
    }),
};

const run = async <T extends QueryResultRow>(
  db: Queryable,
  sql: string,
  params: unknown[],
): Promise<T[]> => {
  try {
    return (await db.query<T>(sql, params)).rows;
  } catch (error) {
    const message = (error as { message?: string } | null)?.message ?? '';
    const known = KNOWN_ERRORS[message];
    throw known ? known() : error;
  }
};

export const registerTablet = async (
  db: Queryable,
  params: {
    passwordHash: string;
    tokenHash: string;
    serialNumber: string | null;
    platform: string | null;
    appVersion: string | null;
    deviceTokenHash: string | null;
  },
): Promise<string> => {
  const [row] = await run<{ field_id: string }>(
    db,
    'SELECT mc_tablet_register($1, $2, $3, $4, $5, $6) AS field_id',
    [
      params.passwordHash,
      params.tokenHash,
      params.serialNumber,
      params.platform,
      params.appVersion,
      params.deviceTokenHash,
    ],
  );
  return row.field_id;
};

export interface TabletRow {
  tablet_id: string;
  field_id: string;
  device_id: string | null;
  machine_id: string | null;
  machine_label: string | null;
}

export const findTabletByToken = async (
  db: Queryable,
  tokenHash: string,
): Promise<TabletRow | null> => {
  const [row] = await run<TabletRow & QueryResultRow>(
    db,
    'SELECT * FROM mc_tablet_for_token($1)',
    [tokenHash],
  );
  return row ?? null;
};

export const changeUnassignedPassword = async (
  db: Queryable,
  tokenHash: string,
  passwordHash: string,
): Promise<boolean> => {
  const [row] = await run<{ changed: boolean }>(
    db,
    'SELECT mc_tablet_change_password($1, $2) AS changed',
    [tokenHash, passwordHash],
  );
  return row.changed;
};

export const openTabletSession = async (
  client: PoolClient,
  tokenHash: string,
  deviceTokenHash: string,
) => {
  const [row] = await run<{
    device_id: string;
    machine_id: string;
    machine_label: string;
  }>(client, 'SELECT * FROM mc_tablet_open_session($1, $2)', [
    tokenHash,
    deviceTokenHash,
  ]);
  return row ?? null;
};

// Null when there's no such tablet for this person.
export const countPasswordAttempt = async (
  client: PoolClient,
  fieldId: string,
  machineId: string | null,
) => {
  const [row] = await run<{
    tablet_id: string;
    password_hash: string;
    machine_id: string | null;
  }>(client, 'SELECT * FROM mc_tablet_password_attempt($1, $2)', [
    fieldId,
    machineId,
  ]);
  return row ?? null;
};

export const acceptPassword = async (
  client: PoolClient,
  tabletId: string,
): Promise<void> => {
  await run(client, 'SELECT mc_tablet_password_accepted($1)', [tabletId]);
};

export const assignTablet = async (
  client: PoolClient,
  tabletId: string,
  machineId: string,
): Promise<void> => {
  await run(client, 'SELECT mc_tablet_assign($1, $2)', [tabletId, machineId]);
};

export const resetTabletPassword = async (
  client: PoolClient,
  machineId: string,
  passwordHash: string,
): Promise<boolean> => {
  const [row] = await run<{ changed: boolean }>(
    client,
    'SELECT mc_tablet_reset_password($1, $2) AS changed',
    [machineId, passwordHash],
  );
  return row.changed;
};

// Null when the machine has no tablet, or one paired with a code.
export const findMachineFieldId = async (
  client: PoolClient,
  machineId: string,
): Promise<string | null> => {
  const [row] = await run<{ field_id: string | null }>(
    client,
    `SELECT mc_tablet_field_id(id) AS field_id FROM mc_devices
     WHERE machine_id = $1 AND disabled_at IS NULL AND deleted_at IS NULL`,
    [machineId],
  );
  return row?.field_id ?? null;
};
