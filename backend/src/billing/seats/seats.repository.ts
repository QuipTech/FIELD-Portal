import { PoolClient } from 'pg';
import { toIsoDay } from '../../common/utils/toIsoDay';
import { ServiceDatabaseService } from '../../database/serviceDatabase.service';
import { SeatInterval } from './seatRules';

export interface SeatRow {
  id: string;
  billing_account_id: string;
  subscription_id: string;
  user_id: string;
  started_on: Date;
  billing_end: Date | null;
}

const SEAT_COLUMNS = `id, billing_account_id, subscription_id, user_id,
  started_on, billing_end`;

export const toSeatInterval = (row: SeatRow): SeatInterval => ({
  id: row.id,
  userId: row.user_id,
  startedOn: toIsoDay(row.started_on),
  billingEnd: row.billing_end ? toIsoDay(row.billing_end) : null,
});

export const listAccountSeats = async (
  serviceDatabase: ServiceDatabaseService,
  billingAccountId: string,
): Promise<SeatRow[]> => {
  const result = await serviceDatabase.query<SeatRow>(
    `SELECT ${SEAT_COLUMNS} FROM billing.seats
     WHERE billing_account_id = $1 AND deleted_at IS NULL
     ORDER BY started_on, id`,
    [billingAccountId],
  );
  return result.rows;
};

export const lockUserSeats = async (
  client: PoolClient,
  subscriptionId: string,
  userId: string,
): Promise<SeatRow[]> => {
  const result = await client.query<SeatRow>(
    `SELECT ${SEAT_COLUMNS} FROM billing.seats
     WHERE subscription_id = $1 AND user_id = $2 AND deleted_at IS NULL
     FOR UPDATE`,
    [subscriptionId, userId],
  );
  return result.rows;
};

export const lockSeat = async (
  client: PoolClient,
  seatId: string,
): Promise<SeatRow | undefined> => {
  const result = await client.query<SeatRow>(
    `SELECT ${SEAT_COLUMNS} FROM billing.seats
     WHERE id = $1 AND deleted_at IS NULL
     FOR UPDATE`,
    [seatId],
  );
  return result.rows[0];
};

export const isUserOnAccount = async (
  client: PoolClient,
  userId: string,
  billingAccountId: string,
): Promise<boolean> => {
  const result = await client.query<{ belongs: boolean }>(
    `SELECT billing.user_belongs_to_account($1, $2) AS belongs`,
    [userId, billingAccountId],
  );
  return result.rows[0]?.belongs === true;
};

export const insertSeat = async (
  client: PoolClient,
  params: {
    billingAccountId: string;
    subscriptionId: string;
    userId: string;
    startedOn: string;
    createdBy: string;
  },
): Promise<SeatRow> => {
  const result = await client.query<SeatRow>(
    `INSERT INTO billing.seats
       (billing_account_id, subscription_id, user_id, started_on, created_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${SEAT_COLUMNS}`,
    [
      params.billingAccountId,
      params.subscriptionId,
      params.userId,
      params.startedOn,
      params.createdBy,
    ],
  );
  return result.rows[0];
};

// billingEnd null reinstates a seat removed earlier this month.
export const setSeatBillingEnd = async (
  client: PoolClient,
  seatId: string,
  billingEnd: string | null,
): Promise<SeatRow> => {
  const result = await client.query<SeatRow>(
    `UPDATE billing.seats SET billing_end = $2, updated_at = now()
     WHERE id = $1
     RETURNING ${SEAT_COLUMNS}`,
    [seatId, billingEnd],
  );
  return result.rows[0];
};
