import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { DatabaseService } from '../../database/database.service';
import { KvsSignalingService } from './kvsSignaling.service';
import { RemoteRecordingService } from './remoteRecording.service';
import * as repository from './remoteSession.repository';
import { RemoteSessionService } from './remoteSession.service';
import {
  REMOTE_INACTIVE_MINUTES,
  REMOTE_LOST_SECONDS,
  REMOTE_MAX_MINUTES,
  REMOTE_RECORDING_GRACE_SECONDS,
  RemoteSessionRow,
} from './remoteSession.types';

const SWEEP_MS = 15 * 1000;
const WORK_MS = 60 * 1000;

// Every 15 seconds: close unanswered requests, sessions without interaction
// for 10 minutes, sessions a side stopped heartbeating for 60 seconds, and
// sessions past 4 hours. Every minute, one container (advisory lock) deletes
// closed sessions' channels, completes recordings the viewer never finished,
// and collects finished transcripts.
@Injectable()
export class RemoteSessionWorkerService {
  private readonly logger = new Logger(RemoteSessionWorkerService.name);
  private working = false;

  constructor(
    private readonly db: DatabaseService,
    private readonly sessions: RemoteSessionService,
    private readonly kvs: KvsSignalingService,
    private readonly recordings: RemoteRecordingService,
  ) {}

  @Interval(SWEEP_MS)
  async sweep() {
    await repository
      .sweep(this.db, REMOTE_INACTIVE_MINUTES, REMOTE_LOST_SECONDS, REMOTE_MAX_MINUTES)
      .catch((error: unknown) =>
        this.logger.warn(`Remote session sweep failed: ${String(error)}`),
      );
  }

  @Interval(WORK_MS)
  async work() {
    if (this.working) return;
    this.working = true;
    try {
      const rows = await this.db.transaction(async (client) => {
        const { rows: lock } = await client.query<{ locked: boolean }>(
          "SELECT pg_try_advisory_xact_lock(hashtext('mc_remote_worker')) AS locked",
        );
        if (!lock[0]?.locked) return [];
        return repository.pendingWork(client, REMOTE_RECORDING_GRACE_SECONDS);
      });
      for (const row of rows) await this.process(row);
    } catch (error) {
      this.logger.warn(`Remote session work failed: ${String(error)}`);
    } finally {
      this.working = false;
    }
  }

  private async process(row: RemoteSessionRow) {
    if (row.channel_arn && !row.channel_deleted_at && this.kvs.isEnabled()) {
      await this.sessions.releaseChannel(row);
    }
    if (['pending', 'recording'].includes(row.recording_status)) {
      await this.sessions
        .finishRecording(row.id, null)
        .catch((error: unknown) =>
          this.logger.warn(`Finishing recording ${row.id} failed: ${String(error)}`),
        );
    }
    if (row.transcript_status === 'processing') {
      try {
        const check = await this.recordings.checkTranscription(row);
        if (check.status === 'completed') {
          await repository.transcriptFinish(this.db, row.id, 'completed', check.text, null);
        } else if (check.status === 'failed') {
          await repository.transcriptFinish(this.db, row.id, 'failed', null, check.error);
        }
      } catch (error) {
        this.logger.warn(`Transcript check ${row.id} failed: ${String(error)}`);
      }
    }
  }
}
