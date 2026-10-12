import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service';
import { StorageService } from '../storage/storage.service';
import { StorageBucket } from '../storage/storageBucket';
import * as myDataRepository from './myData.repository';
import { collectUserData } from './collectUserData';

const POLL_MS = 15_000;
// How long a finished export stays downloadable before its file is deleted.
export const EXPORT_LIFETIME_DAYS = 7;

// Builds queued "My data" exports one at a time (claim uses SKIP LOCKED,
// so several API instances are safe) and deletes expired export files.
// Needs S3 storage; disable with DATA_EXPORT_WORKER_ENABLED=false.
@Injectable()
export class DataExportWorker
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(DataExportWorker.name);
  private timer: NodeJS.Timeout | null = null;
  private isStopped = false;

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly storageService: StorageService,
    private readonly storageBucket: StorageBucket,
    private readonly configService: ConfigService,
  ) {}

  onApplicationBootstrap = () => {
    const isEnabled =
      this.configService.get<string>('DATA_EXPORT_WORKER_ENABLED') !== 'false';
    if (!isEnabled || !this.storageBucket.isConfigured()) {
      this.logger.warn(
        'Data export worker not started (DATA_EXPORT_WORKER_ENABLED=false or no S3 storage).',
      );
      this.isStopped = true;
      return;
    }
    this.scheduleTick(0);
  };

  onModuleDestroy = () => {
    this.isStopped = true;
    if (this.timer) clearTimeout(this.timer);
  };

  private scheduleTick = (delayMs: number) => {
    if (this.isStopped) return;
    this.timer = setTimeout(() => {
      this.tick()
        .catch((error: unknown) =>
          this.logger.error(`Data export worker tick failed: ${String(error)}`),
        )
        .finally(() => this.scheduleTick(POLL_MS));
    }, delayMs);
  };

  // Drains the queue, then tidies expired files.
  private tick = async (): Promise<void> => {
    let job = await myDataRepository.claimExportRequest(this.databaseService);
    while (job && !this.isStopped) {
      await this.buildExport(job);
      job = await myDataRepository.claimExportRequest(this.databaseService);
    }
    await this.deleteExpiredExports();
  };

  private buildExport = async (job: {
    id: string;
    tenant_id: string;
    user_id: string;
  }): Promise<void> => {
    try {
      const data = await this.databaseService.withTenant(
        job.tenant_id,
        (client) => collectUserData(client, job.user_id),
      );
      const stored = await this.storageService.storeDataExport(
        { tenantId: job.tenant_id, userId: job.user_id, requestId: job.id },
        JSON.stringify(data, null, 2),
      );
      const expiresAt = new Date(
        Date.now() + EXPORT_LIFETIME_DAYS * 24 * 60 * 60 * 1000,
      );
      await myDataRepository.finishExportRequest(this.databaseService, {
        id: job.id,
        storageKey: stored.key,
        sizeBytes: stored.sizeBytes,
        expiresAt,
        error: null,
      });
    } catch (error) {
      this.logger.error(`Data export ${job.id} failed: ${String(error)}`);
      await myDataRepository.finishExportRequest(this.databaseService, {
        id: job.id,
        storageKey: null,
        sizeBytes: null,
        expiresAt: null,
        error: 'The export could not be built. Please request it again.',
      });
    }
  };

  private deleteExpiredExports = async (): Promise<void> => {
    const expired = await myDataRepository.expireExportRequests(
      this.databaseService,
    );
    for (const file of expired) {
      if (!file.storage_key) continue;
      await this.storageService
        .deleteFile(file.storage_key, file.tenant_id)
        .catch((error: unknown) =>
          this.logger.warn(
            `Couldn't delete expired export ${file.storage_key}: ${String(error)}`,
          ),
        );
    }
  };
}
