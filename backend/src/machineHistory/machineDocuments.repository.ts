import { PoolClient } from 'pg';
import { StoredFile } from '../storage/types/storedFile';
import { MachineDocumentType } from './dto/machineDocumentDtos';
import {
  MachineDocumentListRow,
  MachineDocumentRow,
} from './types/machineHistoryRows';

const DOCUMENT_COLUMNS = `d.id, d.history_entry_id, d.document_type, d.storage_key,
  d.file_name, d.content_type, d.size_bytes, d.uploaded_by, d.created_at`;

// Newest first. An uploader in another organisation (the reader can't see
// its people, users RLS) shows as that organisation.
export const listDocuments = async (
  client: PoolClient,
  params: {
    tenantId: string;
    machineId: string;
    documentType: MachineDocumentType | null;
  },
): Promise<MachineDocumentListRow[]> => {
  const result = await client.query<MachineDocumentListRow>(
    `SELECT ${DOCUMENT_COLUMNS},
            u.first_name AS uploader_first_name, u.last_name AS uploader_last_name,
            CASE WHEN u.id IS NULL AND d.uploaded_by IS NOT NULL
              THEN person_organisation_name(d.uploaded_by) END AS uploader_organisation_name
     FROM machine_documents d
     LEFT JOIN users u ON u.id = d.uploaded_by
     WHERE d.tenant_id = $1 AND d.machine_id = $2 AND d.deleted_at IS NULL
       AND ($3::varchar IS NULL OR d.document_type = $3)
     ORDER BY d.created_at DESC, d.id`,
    [params.tenantId, params.machineId, params.documentType],
  );
  return result.rows;
};

// The entry is live, on this machine, and by requiredAuthorId when given.
export const canAttachToEntry = async (
  client: PoolClient,
  params: {
    tenantId: string;
    machineId: string;
    entryId: string;
    requiredAuthorId: string | null;
  },
): Promise<boolean> => {
  const result = await client.query(
    `SELECT 1 FROM technical_history_entries
     WHERE id = $1 AND machine_id = $2 AND tenant_id = $3 AND deleted_at IS NULL
       AND ($4::uuid IS NULL OR created_by = $4)`,
    [
      params.entryId,
      params.machineId,
      params.tenantId,
      params.requiredAuthorId,
    ],
  );
  return (result.rowCount ?? 0) > 0;
};

export const insertDocument = async (
  client: PoolClient,
  params: {
    tenantId: string;
    machineId: string;
    historyEntryId: string | null;
    documentType: MachineDocumentType;
    userId: string;
    stored: StoredFile;
  },
): Promise<MachineDocumentRow> => {
  const { stored } = params;
  const result = await client.query<MachineDocumentRow>(
    `INSERT INTO machine_documents AS d
       (tenant_id, machine_id, history_entry_id, document_type, storage_key,
        file_name, content_type, size_bytes, uploaded_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING ${DOCUMENT_COLUMNS}`,
    [
      params.tenantId,
      params.machineId,
      params.historyEntryId,
      params.documentType,
      stored.key,
      stored.fileName,
      stored.contentType,
      stored.sizeBytes,
      params.userId,
    ],
  );
  return result.rows[0];
};

// Soft delete only: the row and the S3 object stay for the audit trail.
export const softDeleteDocument = async (
  client: PoolClient,
  params: {
    tenantId: string;
    machineId: string;
    documentId: string;
    // Only this person's upload, when set.
    uploadedBy: string | null;
  },
): Promise<{ file_name: string } | null> => {
  const result = await client.query<{ file_name: string }>(
    `UPDATE machine_documents SET deleted_at = now()
     WHERE id = $1 AND machine_id = $2 AND tenant_id = $3 AND deleted_at IS NULL
       AND ($4::uuid IS NULL OR uploaded_by = $4)
     RETURNING file_name`,
    [params.documentId, params.machineId, params.tenantId, params.uploadedBy],
  );
  return result.rows[0] ?? null;
};
