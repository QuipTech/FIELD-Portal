import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { StorageBucket } from '../storage/storageBucket';
import { IndexingConfig } from './indexingConfig';
import * as indexingRepository from './indexingWorker.repository';
import { IndexingJob } from './indexingWorker.repository';
import {
  IndexingCancelledError,
  IndexingPipelineService,
} from './indexingPipeline.service';
import { toIndexingErrorMessage } from './indexingErrorMessage';

const IDLE_POLL_MS = 5000;
// A job whose progress hasn't moved for this long is assumed dead (the
// process crashed) and is picked up again.
const STALE_JOB_MINUTES = 30;

// DB-polling queue consumer: claims queued document versions one at a time
// (SKIP LOCKED, so several API instances can run it safely) and indexes
// them. Polls every 5 s when idle; requestRun() wakes it straight away.
@Injectable()
export class IndexingWorkerService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(IndexingWorkerService.name);
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private isStopped = false;

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly storageBucket: StorageBucket,
    private readonly indexingConfig: IndexingConfig,
    private readonly pipeline: IndexingPipelineService,
  ) {}

  onApplicationBootstrap = () => {
    if (
      !this.indexingConfig.isWorkerEnabled ||
      !this.storageBucket.isConfigured()
    ) {
      this.logger.warn(
        'Knowledge indexing worker not started (KNOWLEDGE_INDEXING_ENABLED=false or no S3 storage).',
      );
      this.isStopped = true;
      return;
    }
    this.requestRun();
  };

  onModuleDestroy = () => {
    this.isStopped = true;
    if (this.timer) clearTimeout(this.timer);
  };

  // Called after an upload so a new document doesn't wait for the next poll.
  requestRun = (): void => {
    if (this.isStopped || this.isRunning) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    void this.drainQueue();
  };

  private drainQueue = async (): Promise<void> => {
    this.isRunning = true;
    try {
      for (;;) {
        const job = await indexingRepository.claimNextJob(
          this.databaseService,
          STALE_JOB_MINUTES,
        );
        if (!job || this.isStopped) break;
        await this.runJob(job);
      }
    } catch (error) {
      this.logger.error(`Indexing queue poll failed: ${String(error)}`);
    } finally {
      this.isRunning = false;
      if (!this.isStopped)
        this.timer = setTimeout(this.requestRun, IDLE_POLL_MS);
    }
  };

  private runJob = async (job: IndexingJob): Promise<void> => {
    this.logger.log(`Indexing "${job.title}" (version ${job.version_id})`);
    try {
      const state = await this.pipeline.indexVersion(job);
      this.logger.log(`Indexed "${job.title}" → ${state}`);
    } catch (error) {
      if (error instanceof IndexingCancelledError) {
        this.logger.log(`Indexing of version ${job.version_id} was cancelled`);
        return;
      }
      this.logger.warn(
        `Indexing "${job.title}" failed: ${error instanceof Error ? error.stack : String(error)}`,
      );
      await indexingRepository.failIndexing(this.databaseService, {
        versionId: job.version_id,
        message: toIndexingErrorMessage(error),
      });
    }
  };
}
