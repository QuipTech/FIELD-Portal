import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { StorageService } from '../storage/storage.service';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { runAuditedChange } from '../common/audit/runAuditedChange';
import * as myDataRepository from './myData.repository';
import { DataExportRow } from './myData.repository';

const EXPORT_IN_PROGRESS_MESSAGE =
  'An export is already being prepared. It will appear here when it is ready.';

export interface DataExportStatus {
  id: string;
  status: DataExportRow['status'];
  requestedAt: string;
  completedAt: string | null;
  expiresAt: string | null;
  // A 15-minute signed link, only while the export is ready.
  downloadUrl: string | null;
  sizeBytes: number | null;
}

// "Export my data": the request is recorded here; DataExportWorker builds
// the file in the background.
@Injectable()
export class MyDataExportService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly storageService: StorageService,
  ) {}

  requestExport = async (
    actor: AuthenticatedUser,
  ): Promise<DataExportStatus> => {
    const row = await runAuditedChange(
      this.databaseService,
      actor,
      EXPORT_IN_PROGRESS_MESSAGE,
      async (client) => {
        const created = await myDataRepository.insertExportRequest(
          client,
          actor.tenantId,
          actor.userId,
        );
        const audit = {
          action: 'create' as const,
          entityType: 'data_export_request',
          entityId: created.id,
          metadata: { name: actor.email },
        };
        return { result: created, audit };
      },
    );
    return this.toStatus(row);
  };

  // The newest export, or null if the user never asked for one.
  getLatestExport = async (
    actor: AuthenticatedUser,
  ): Promise<DataExportStatus | null> => {
    const row = await this.databaseService.withTenant(
      actor.tenantId,
      (client) => myDataRepository.findLatestExport(client, actor.userId),
    );
    return row ? this.toStatus(row) : null;
  };

  private toStatus = async (row: DataExportRow): Promise<DataExportStatus> => {
    const isDownloadable =
      row.status === 'ready' &&
      row.storage_key &&
      (!row.expires_at || row.expires_at > new Date());
    const downloadUrl = isDownloadable
      ? await this.storageService
          .getSignedDownloadUrl(row.storage_key!, 'field-my-data-export.json')
          .then((signed) => signed.url)
          .catch(() => null)
      : null;
    return {
      id: row.id,
      status: row.status,
      requestedAt: row.requested_at.toISOString(),
      completedAt: row.completed_at?.toISOString() ?? null,
      expiresAt: row.expires_at?.toISOString() ?? null,
      downloadUrl,
      sizeBytes: row.size_bytes === null ? null : Number(row.size_bytes),
    };
  };
}
