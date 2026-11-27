import { PoolClient } from 'pg';
import { TabletFileSend } from './tabletFiles.types';

const MAX_LISTED_SENDS = 20;

// A send already made with this ID, to make retries safe.
export const findSend = async (
  client: PoolClient,
  senderTenantId: string,
  sendId: string,
) =>
  (
    await client.query<{
      id: string;
      machineId: string;
      manifestHash: string;
    }>(
      `SELECT id, machine_id AS "machineId", preview_hash AS "manifestHash"
       FROM mc_design_deliveries WHERE sender_tenant_id = $1 AND batch_id = $2`,
      [senderTenantId, sendId],
    )
  ).rows[0];

export const hasRemovedTablet = async (
  client: PoolClient,
  machineId: string,
): Promise<boolean> =>
  (
    await client.query(
      `SELECT 1 FROM mc_devices
       WHERE machine_id = $1 AND (disabled_at IS NOT NULL OR deleted_at IS NOT NULL)
       LIMIT 1`,
      [machineId],
    )
  ).rows.length > 0;

export const hasConnectedTablet = async (
  client: PoolClient,
  machineId: string,
): Promise<boolean> =>
  (
    await client.query(
      `SELECT 1 FROM mc_devices
       WHERE machine_id = $1 AND disabled_at IS NULL AND deleted_at IS NULL`,
      [machineId],
    )
  ).rows.length > 0;

export const insertSendHistoryEntry = (
  client: PoolClient,
  params: {
    tenantId: string;
    machineId: string;
    userId: string;
    description: string;
    deliveryId: string;
  },
) =>
  client.query(
    `INSERT INTO technical_history_entries
       (tenant_id, machine_id, entry_type, description, created_by, design_delivery_id)
     VALUES ($1, $2, 'file_transfer', $3, $4, $5)`,
    [
      params.tenantId,
      params.machineId,
      params.description,
      params.userId,
      params.deliveryId,
    ],
  );

// Newest first; one send when deliveryId is given. tenantId is the machine's
// owning organisation, where its history lives.
export const listSends = async (
  client: PoolClient,
  tenantId: string,
  machineId: string,
  deliveryId: string | null = null,
): Promise<TabletFileSend[]> => {
  const { rows } = await client.query<{
    send: Omit<TabletFileSend, 'senderName'> | null;
    senderName: string | null;
  }>(
    `SELECT mc_file_send(e.design_delivery_id) AS send,
            COALESCE(
              NULLIF(trim(concat_ws(' ', u.first_name, u.last_name)), ''),
              person_organisation_name(e.created_by)) AS "senderName"
     FROM technical_history_entries e
     LEFT JOIN users u ON u.id = e.created_by
     WHERE e.tenant_id = $1 AND e.machine_id = $2 AND e.entry_type = 'file_transfer'
       AND e.deleted_at IS NULL
       AND ($3::uuid IS NULL OR e.design_delivery_id = $3)
     ORDER BY e.created_at DESC, e.id DESC
     LIMIT $4`,
    [tenantId, machineId, deliveryId, MAX_LISTED_SENDS],
  );
  return rows.flatMap(({ send, senderName }) =>
    send ? [{ ...send, senderName }] : [],
  );
};
