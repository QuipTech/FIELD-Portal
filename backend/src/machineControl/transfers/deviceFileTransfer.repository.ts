import { PoolClient } from 'pg';
import { MachineDocumentType } from '../../machineHistory/dto/machineDocumentDtos';
import { StoredFile } from '../../storage/types/storedFile';
import { PairedDevice } from '../session/deviceSession.service';

interface TransferReceipt {
  id: string;
  fileName: string;
  documentType: MachineDocumentType;
  uploadedAt: Date;
}

const RECEIPT_COLUMNS = `id, file_name AS "fileName",
  document_type AS "documentType", created_at AS "uploadedAt"`;

export const findTransfer = async (
  client: PoolClient,
  device: PairedDevice,
  transferId: string,
): Promise<TransferReceipt | undefined> => {
  const { rows } = await client.query<TransferReceipt>(
    `SELECT ${RECEIPT_COLUMNS} FROM machine_documents
     WHERE tenant_id = $1 AND machine_id = $2
       AND source_device_id = $3 AND device_transfer_id = $4`,
    [device.tenantId, device.machineId, device.deviceId, transferId],
  );
  return rows[0];
};

export const insertTransfer = async (
  client: PoolClient,
  device: PairedDevice,
  transferId: string,
  documentType: MachineDocumentType,
  stored: StoredFile,
): Promise<TransferReceipt | undefined> => {
  const { rows } = await client.query<TransferReceipt>(
    `INSERT INTO machine_documents
       (tenant_id, machine_id, source_device_id, device_transfer_id,
        document_type, storage_key, file_name, content_type, size_bytes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (source_device_id, device_transfer_id) DO NOTHING
     RETURNING ${RECEIPT_COLUMNS}`,
    [
      device.tenantId,
      device.machineId,
      device.deviceId,
      transferId,
      documentType,
      stored.key,
      stored.fileName,
      stored.contentType,
      stored.sizeBytes,
    ],
  );
  return rows[0];
};
