import { PoolClient } from 'pg';
import { CaseAttachmentRow } from './types/supportCaseRows';

const ATTACHMENT_COLUMNS = `id, message_id, file_name, file_type, size_bytes, storage_key`;

// An upload waits here, unlinked, until the message carrying it is sent.
// caseId is null for a customer's upload on the New case form (the case
// doesn't exist yet).
export const insertPendingAttachment = async (
  client: PoolClient,
  params: {
    tenantId: string;
    caseId: string | null;
    uploadedBy: string;
    storageKey: string;
    fileName: string;
    contentType: string;
    sizeBytes: number;
  },
): Promise<CaseAttachmentRow> => {
  const result = await client.query<CaseAttachmentRow>(
    `INSERT INTO support_attachments
       (tenant_id, support_case_id, uploaded_by, storage_key, file_name, file_type, size_bytes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING ${ATTACHMENT_COLUMNS}`,
    [
      params.tenantId,
      params.caseId,
      params.uploadedBy,
      params.storageKey,
      params.fileName,
      params.contentType,
      params.sizeBytes,
    ],
  );
  return result.rows[0];
};

// Links the sender's own unlinked uploads to their message. Returns how
// many were linked, so the caller can refuse ids that weren't theirs.
export const linkAttachmentsToMessage = async (
  client: PoolClient,
  params: {
    tenantId: string;
    caseId: string;
    messageId: string;
    uploaderId: string;
    attachmentIds: string[];
  },
): Promise<number> => {
  const result = await client.query(
    `UPDATE support_attachments
     SET support_case_id = $2, message_id = $3
     WHERE tenant_id = $1 AND id = ANY($5::uuid[]) AND uploaded_by = $4
       AND message_id IS NULL
       AND (support_case_id IS NULL OR support_case_id = $2)`,
    [
      params.tenantId,
      params.caseId,
      params.messageId,
      params.uploaderId,
      params.attachmentIds,
    ],
  );
  return result.rowCount ?? 0;
};

export const listMessageAttachments = async (
  client: PoolClient,
  tenantId: string,
  messageIds: string[],
): Promise<CaseAttachmentRow[]> => {
  if (!messageIds.length) return [];
  const result = await client.query<CaseAttachmentRow>(
    `SELECT ${ATTACHMENT_COLUMNS} FROM support_attachments
     WHERE tenant_id = $1 AND message_id = ANY($2::uuid[]) AND storage_key IS NOT NULL
     ORDER BY created_at, id`,
    [tenantId, messageIds],
  );
  return result.rows;
};
