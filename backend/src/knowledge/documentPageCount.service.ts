import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { StorageService } from '../storage/storage.service';
import {
  countDocumentPages,
  UnreadableDocumentError,
} from './documentPageCounter';
import * as documentPageCountRepository from './documentPageCount.repository';
import { VersionAwaitingPageCount } from './documentPageCount.repository';

const BATCH_SIZE = 10;
// Parsing loads the whole file into memory; bigger files are marked
// checked with no count rather than risking the API process.
const MAX_PARSE_BYTES = 150 * 1024 * 1024;

// Counts pages of newly uploaded documents in the background, one file at
// a time, so a 500 MB manual never holds up an upload response. Runs at
// startup (catching anything missed while the API was down) and whenever
// an upload completes.
@Injectable()
export class DocumentPageCountService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DocumentPageCountService.name);
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly storageService: StorageService,
  ) {}

  onApplicationBootstrap = () => this.requestSweep();

  // Chained so sweeps never overlap; never rejects.
  requestSweep = (): void => {
    this.queue = this.queue
      .then(this.sweep)
      .catch((error: unknown) =>
        this.logger.warn(`Page count sweep stopped: ${String(error)}`),
      );
  };

  private sweep = async (): Promise<void> => {
    for (;;) {
      const batch =
        await documentPageCountRepository.listVersionsAwaitingPageCount(
          this.databaseService,
          BATCH_SIZE,
        );
      if (batch.length === 0) return;
      // Sequential on purpose: one file in memory at a time.
      for (const version of batch) await this.countVersion(version);
    }
  };

  // Transient failures (S3 or the network) propagate and end the sweep
  // without marking the file, so the next sweep retries it.
  private countVersion = async (
    version: VersionAwaitingPageCount,
  ): Promise<void> => {
    const record = (pageCount: number | null, isUnreadable = false) =>
      documentPageCountRepository.recordPageCount(this.databaseService, {
        versionId: version.version_id,
        pageCount,
        isUnreadable,
      });

    if (Number(version.size_bytes ?? 0) > MAX_PARSE_BYTES) {
      this.logger.log(
        `Skipping page count for ${version.version_id}: file too large to parse`,
      );
      return record(null);
    }
    const bytes = await this.storageService.readObject(version.storage_key);
    try {
      return record(await countDocumentPages(bytes, version.content_type));
    } catch (error) {
      if (!(error instanceof UnreadableDocumentError)) throw error;
      this.logger.warn(
        `Document version ${version.version_id} is unreadable: ${error.message}`,
      );
      return record(null, true);
    }
  };
}
