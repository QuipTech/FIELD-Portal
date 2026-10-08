import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { StorageService } from '../storage/storage.service';
import { StorageBucket } from '../storage/storageBucket';
import { IncomingFile } from '../storage/types/storedFile';
import {
  insertPendingAttachment,
  listMessageAttachments,
} from './caseAttachments.repository';
import { toCaseMessage } from './supportCaseMapper';
import { CaseAttachment, CaseMessage } from './types/supportCaseResponse';
import { CaseAttachmentRow, CaseMessageRow } from './types/supportCaseRows';

const IMAGE_CONTENT_TYPE = /^image\//;

// Files on case messages: stored privately under cases/{tenantId}/, shown
// through short-lived signed URLs (photos inline, documents as downloads).
@Injectable()
export class CaseAttachmentsService {
  constructor(
    private readonly storageService: StorageService,
    private readonly storageBucket: StorageBucket,
  ) {}

  // The upload waits unlinked until a message carries it (attachmentIds).
  upload = async (
    client: PoolClient,
    params: {
      tenantId: string;
      caseId: string | null;
      uploaderId: string;
      file: IncomingFile | undefined;
    },
  ): Promise<CaseAttachment> => {
    const stored = await this.storageService.uploadCaseAttachment(
      params.file,
      params.tenantId,
      params.caseId,
    );
    const row = await insertPendingAttachment(client, {
      tenantId: params.tenantId,
      caseId: params.caseId,
      uploadedBy: params.uploaderId,
      storageKey: stored.key,
      fileName: stored.fileName,
      contentType: stored.contentType,
      sizeBytes: stored.sizeBytes,
    });
    return this.toAttachment(row);
  };

  // Messages with their attachments, in one query for the whole thread.
  toMessages = async (
    client: PoolClient,
    tenantId: string,
    rows: CaseMessageRow[],
  ): Promise<CaseMessage[]> => {
    const attachments = await listMessageAttachments(
      client,
      tenantId,
      rows.map((row) => row.id),
    );
    const signed = await Promise.all(
      attachments.map(async (row) => ({
        messageId: row.message_id,
        attachment: await this.toAttachment(row),
      })),
    );
    return rows.map((row) =>
      toCaseMessage(
        row,
        signed
          .filter((entry) => entry.messageId === row.id)
          .map((entry) => entry.attachment),
      ),
    );
  };

  private toAttachment = async (
    row: CaseAttachmentRow,
  ): Promise<CaseAttachment> => {
    const isImage = IMAGE_CONTENT_TYPE.test(row.file_type);
    const url = this.storageBucket.isConfigured()
      ? (
          await this.storageService.getSignedDownloadUrl(
            row.storage_key,
            isImage ? undefined : row.file_name,
          )
        ).url
      : null;
    return {
      id: row.id,
      fileName: row.file_name,
      contentType: row.file_type,
      sizeBytes: Number(row.size_bytes),
      url,
    };
  };
}
