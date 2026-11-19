import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PoolClient } from 'pg';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { hashToken } from '../../common/security/tokenHasher';
import { DatabaseService } from '../../database/database.service';
import { requireMachineAccess } from '../../machineSharing/access/machineAccess';
import { IncomingFile } from '../../storage/types/storedFile';
import {
  findDeviceByTokenHash,
  findSessionState,
} from '../session/deviceSession.repository';
import {
  PairedDevice,
  revokedTokenError,
} from '../session/deviceSession.service';
import { KvsSignalingService } from './kvsSignaling.service';
import { RemoteRecordingService } from './remoteRecording.service';
import * as repository from './remoteSession.repository';
import {
  CreateRemoteSessionDto,
  REMOTE_MAX_PART_BYTES,
  REMOTE_MAX_PARTS,
  REMOTE_RECORDING_GRACE_SECONDS,
  REMOTE_REQUEST_SECONDS,
  RemoteDecisionDto,
  RemoteSession,
  RemoteSessionRow,
  RequestRemoteHelpDto,
  RemoteSignalingConnection,
  toRemoteSession,
} from './remoteSession.types';

const notActive = () =>
  new ConflictException({
    code: 'remote_session_not_active',
    message: 'This remote session is not running.',
  });

const notFound = () =>
  new NotFoundException({
    code: 'remote_session_not_found',
    message: 'Remote session not found.',
  });

const notRequester = () =>
  new ForbiddenException({
    code: 'remote_session_not_requester',
    message: 'Only the person who started this remote session can do that.',
  });

// Remote support sessions (migration 0139) for both sides: the Portal
// person who asks, views and records, and the tablet that answers and
// streams. Access to the media is a presigned signaling connection per
// side (KvsSignalingService), issued only while the session is active.
@Injectable()
export class RemoteSessionService {
  private readonly logger = new Logger(RemoteSessionService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly kvs: KvsSignalingService,
    private readonly recordings: RemoteRecordingService,
  ) {}

  // ── Portal ──────────────────────────────────────────────────────────

  create = (
    actor: AuthenticatedUser,
    machineId: string,
    dto: CreateRemoteSessionDto,
  ): Promise<RemoteSession> => {
    this.kvs.requireEnabled();
    return this.db.withActor(actor, async (client) => {
      await requireMachineAccess(client, machineId, 'contribute');
      const state = await findSessionState(client, machineId);
      if (state && !state.tabletOnline) {
        throw new ConflictException({
          code: 'remote_tablet_offline',
          message:
            "This machine's tablet is offline. Remote support needs the FIELD Machine app open and online.",
        });
      }
      const row = await repository.requestSession(client, {
        machineId,
        control: dto.control ?? true,
        viewerClientId: `viewer-${randomBytes(16).toString('hex')}`,
        requestSeconds: REMOTE_REQUEST_SECONDS,
      });
      return toRemoteSession(row);
    });
  };

  get = async (
    actor: AuthenticatedUser,
    machineId: string,
    sessionId: string,
  ): Promise<RemoteSession> =>
    toRemoteSession(await this.portalRow(actor, machineId, sessionId, 'read'));

  pendingHelp = (actor: AuthenticatedUser, machineId: string) =>
    this.db.withActor(actor, async (client) => {
      await requireMachineAccess(client, machineId, 'contribute');
      const row = await repository.findPendingHelp(client, machineId);
      return { session: row ? toRemoteSession(row) : null };
    });

  claimHelp = (actor: AuthenticatedUser, machineId: string, sessionId: string) => {
    this.kvs.requireEnabled();
    return this.db.withActor(actor, async (client) => {
      await requireMachineAccess(client, machineId, 'contribute');
      return toRemoteSession(await repository.claimHelp(client, machineId, sessionId));
    });
  };

  // The viewer's presigned way onto the channel; the requester only.
  viewerConnection = async (
    actor: AuthenticatedUser,
    machineId: string,
    sessionId: string,
  ): Promise<RemoteSignalingConnection> => {
    const row = await this.portalRow(actor, machineId, sessionId, 'read');
    if (row.requester_id !== actor.userId) throw notRequester();
    return this.connection(row, 'VIEWER');
  };

  viewerHeartbeat = (
    actor: AuthenticatedUser,
    machineId: string,
    sessionId: string,
    interacted: boolean,
  ): Promise<RemoteSession> =>
    this.db.withActor(actor, async (client) => {
      await requireMachineAccess(client, machineId, 'read');
      const row = await repository.findForMachine(client, machineId, sessionId);
      if (!row) throw notFound();
      if (row.requester_id !== actor.userId) throw notRequester();
      return toRemoteSession(
        await repository.touch(client, {
          sessionId,
          side: 'viewer',
          interacted,
          deviceId: null,
        }),
      );
    });

  // The requester, or anyone allowed to add to the machine, ends it.
  endFromPortal = async (
    actor: AuthenticatedUser,
    machineId: string,
    sessionId: string,
  ): Promise<RemoteSession> => {
    const row = await this.db.withActor(actor, async (client) => {
      const current = await repository.findForMachine(
        client,
        machineId,
        sessionId,
      );
      if (!current) throw notFound();
      if (current.requester_id !== actor.userId) {
        await requireMachineAccess(client, machineId, 'contribute');
      }
      return repository.endSession(client, {
        sessionId,
        reason: current.status === 'requested' ? 'cancelled' : 'portal_ended',
        by: 'portal',
        deviceId: null,
      });
    });
    await this.releaseChannel(row);
    return toRemoteSession(row);
  };

  // One part of the recording, in order from 1; the requester only.
  uploadRecordingPart = async (
    actor: AuthenticatedUser,
    machineId: string,
    sessionId: string,
    partNumber: number,
    file: IncomingFile | undefined,
  ): Promise<{ part: number; bytes: number }> => {
    if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > REMOTE_MAX_PARTS) {
      throw new BadRequestException('Part number must be 1 to 2000.');
    }
    if (!file?.buffer?.length) throw new BadRequestException('Part is empty.');
    if (file.buffer.length > REMOTE_MAX_PART_BYTES) {
      throw new PayloadTooLargeException('Recording part is too large.');
    }
    const row = await this.portalRow(actor, machineId, sessionId, 'read');
    if (row.requester_id !== actor.userId) throw notRequester();
    this.assertRecordingOpen(row);

    let current = row;
    if (current.recording_status === 'pending') {
      const key = this.recordings.recordingKey(row);
      const uploadId = await this.recordings.createUpload(key);
      current = await repository.recordingStart(this.db, sessionId, key, uploadId);
      if (current.recording_upload_id !== uploadId) {
        await this.recordings.abort(key, uploadId);
      }
    }
    if (current.recording_status !== 'recording') throw notActive();
    const etag = await this.recordings.uploadPart(
      current.recording_key!,
      current.recording_upload_id!,
      partNumber,
      file.buffer,
    );
    await repository.recordingPart(
      this.db,
      sessionId,
      partNumber,
      etag,
      file.buffer.length,
    );
    return { part: partNumber, bytes: file.buffer.length };
  };

  // The viewer's recording is complete (or failed on its side).
  completeRecording = async (
    actor: AuthenticatedUser,
    machineId: string,
    sessionId: string,
    failed: boolean,
  ): Promise<RemoteSession> => {
    const row = await this.portalRow(actor, machineId, sessionId, 'read');
    if (row.requester_id !== actor.userId) throw notRequester();
    return toRemoteSession(
      await this.finishRecording(
        sessionId,
        failed ? 'The viewer could not record this session.' : null,
      ),
    );
  };

  recordingUrl = async (
    actor: AuthenticatedUser,
    machineId: string,
    sessionId: string,
  ) => {
    const row = await this.portalRow(actor, machineId, sessionId, 'read');
    if (row.recording_status !== 'completed' || !row.recording_key) {
      throw new NotFoundException({
        code: 'remote_recording_unavailable',
        message: 'This session has no recording to play.',
      });
    }
    return this.recordings.playbackUrl(row);
  };

  transcript = async (
    actor: AuthenticatedUser,
    machineId: string,
    sessionId: string,
  ) => {
    const row = await this.portalRow(actor, machineId, sessionId, 'read');
    return {
      status: row.transcript_status,
      text: row.transcript_status === 'completed' ? row.transcript_text ?? '' : null,
      error: row.transcript_status === 'failed' ? row.transcript_error : null,
    };
  };

  // ── Tablet ──────────────────────────────────────────────────────────

  requestHelp = (device: PairedDevice, token: string, dto: RequestRemoteHelpDto) => {
    this.kvs.requireEnabled();
    return this.withDevice(device, token, async (client) =>
      toRemoteSession(
        await repository.requestHelp(
          client,
          device.deviceId,
          dto.requestId,
          dto.control,
          `viewer-${randomBytes(16).toString('hex')}`,
        ),
      ),
    );
  };

  // The tablet's open session (requested or active), if any: for start-up,
  // reconnects, and a missed remote:requested event.
  currentForDevice = (device: PairedDevice, token: string) =>
    this.withDevice(device, token, async (client) => {
      const row = await repository.findForDevice(client, device.deviceId, null);
      return { session: row ? toRemoteSession(row) : null };
    });

  getForDevice = (device: PairedDevice, token: string, sessionId: string) =>
    this.withDevice(device, token, async (client) => {
      const row = await repository.findForDevice(
        client,
        device.deviceId,
        sessionId,
      );
      if (!row) throw notFound();
      return toRemoteSession(row);
    });

  decide = (
    device: PairedDevice,
    token: string,
    sessionId: string,
    dto: RemoteDecisionDto,
  ): Promise<RemoteSession> =>
    this.withDevice(device, token, async (client) => {
      const row = await repository.findForDevice(client, device.deviceId, sessionId);
      if (!row) throw notFound();
      if (row.initiated_by === 'tablet') {
        throw new ConflictException({
          code: 'remote_session_claim_required',
          message: 'A Portal support user must join this help request.',
        });
      }
      return toRemoteSession(
        await repository.decide(client, {
          deviceId: device.deviceId,
          sessionId,
          allow: dto.decision === 'allow',
          allowControl: dto.allowControl ?? true,
        }),
      );
    });

  tabletConnection = async (
    device: PairedDevice,
    token: string,
    sessionId: string,
  ): Promise<RemoteSignalingConnection> => {
    const row = await this.withDevice(device, token, (client) =>
      repository.findForDevice(client, device.deviceId, sessionId),
    );
    if (!row) throw notFound();
    return this.connection(row, 'MASTER');
  };

  tabletHeartbeat = (
    device: PairedDevice,
    token: string,
    sessionId: string,
    interacted: boolean,
  ): Promise<RemoteSession> =>
    this.withDevice(device, token, async (client) =>
      toRemoteSession(
        await repository.touch(client, {
          sessionId,
          side: 'tablet',
          interacted,
          deviceId: device.deviceId,
        }),
      ),
    );

  endFromTablet = async (
    device: PairedDevice,
    token: string,
    sessionId: string,
  ): Promise<RemoteSession> => {
    const row = await this.withDevice(device, token, (client) =>
      repository.endSession(client, {
        sessionId,
        reason: 'tablet_ended',
        by: 'tablet',
        deviceId: device.deviceId,
      }),
    );
    await this.releaseChannel(row);
    return toRemoteSession(row);
  };

  // ── Shared ──────────────────────────────────────────────────────────

  // Completes (or fails) the recording once, whoever gets there first: the
  // viewer at the end, or the worker after the grace period.
  finishRecording = (
    sessionId: string,
    viewerError: string | null,
  ): Promise<RemoteSessionRow> =>
    this.db.transaction(async (client) => {
      await client.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1, 39))',
        [sessionId],
      );
      const { rows } = await client.query<RemoteSessionRow>(
        'SELECT * FROM mc_remote_sessions_by_id($1)',
        [sessionId],
      );
      const row = rows[0];
      if (!row) throw notFound();
      if (!['pending', 'recording'].includes(row.recording_status)) return row;

      const fail = async (message: string) => {
        if (row.recording_key && row.recording_upload_id) {
          await this.recordings.abort(row.recording_key, row.recording_upload_id);
        }
        return repository.recordingFinish(client, sessionId, 'failed', message, null);
      };
      if (viewerError) return fail(viewerError);
      if (row.recording_status === 'pending' || row.recording_parts.length === 0) {
        return fail('No recording was uploaded for this session.');
      }
      try {
        await this.recordings.complete(row);
      } catch (error) {
        this.logger.warn(`Completing recording ${sessionId} failed: ${String(error)}`);
        return fail('The recording could not be saved.');
      }
      const job = await this.recordings.startTranscription(row);
      return repository.recordingFinish(client, sessionId, 'completed', null, job);
    });

  // Deletes a closed session's channel; the worker retries any failure.
  releaseChannel = async (row: RemoteSessionRow): Promise<void> => {
    if (['requested', 'active'].includes(row.status) || !row.channel_arn) return;
    if (row.channel_deleted_at) return;
    try {
      await this.kvs.deleteChannel(row.channel_arn);
      await repository.channelDeleted(this.db, row.id);
    } catch (error) {
      this.logger.warn(`Deleting channel for ${row.id} failed: ${String(error)}`);
    }
  };

  private connection = async (
    row: RemoteSessionRow,
    role: 'MASTER' | 'VIEWER',
  ): Promise<RemoteSignalingConnection> => {
    if (row.status !== 'active' || !row.channel_name) throw notActive();
    const channelArn =
      row.channel_arn ?? (await this.kvs.ensureChannel(row.channel_name));
    if (!row.channel_arn) await repository.setChannel(this.db, row.id, channelArn);

    // The session may have closed while the channel was being made.
    const { rows } = await this.db.query<RemoteSessionRow>(
      'SELECT * FROM mc_remote_sessions_by_id($1)',
      [row.id],
    );
    if (rows[0]?.status !== 'active') {
      await this.releaseChannel({ ...rows[0], channel_arn: channelArn });
      throw notActive();
    }
    const clientId = role === 'VIEWER' ? row.viewer_client_id : null;
    const access = await this.kvs.access({ channelArn, role, clientId });
    return {
      sessionId: row.id,
      role,
      region: this.kvs.region,
      channelArn,
      clientId,
      viewerClientId: row.viewer_client_id,
      controlAllowed: row.control_granted,
      ...access,
    };
  };

  private assertRecordingOpen(row: RemoteSessionRow) {
    if (!row.record) throw notActive();
    if (row.status === 'active') return;
    const endedAt = row.ended_at ? new Date(row.ended_at).getTime() : 0;
    const withinGrace =
      row.status === 'ended' &&
      Date.now() - endedAt < REMOTE_RECORDING_GRACE_SECONDS * 1000;
    if (!withinGrace || row.recording_status !== 'recording') throw notActive();
  }

  private portalRow = (
    actor: AuthenticatedUser,
    machineId: string,
    sessionId: string,
    need: 'read' | 'contribute',
  ): Promise<RemoteSessionRow> =>
    this.db.withActor(actor, async (client) => {
      await requireMachineAccess(client, machineId, need);
      const row = await repository.findForMachine(client, machineId, sessionId);
      if (!row) throw notFound();
      return row;
    });

  // As design delivery: the token is still this tablet's, and the machine
  // is active with Machine Control on.
  private withDevice<T>(
    device: PairedDevice,
    token: string,
    work: (client: PoolClient) => Promise<T>,
  ) {
    return this.db.withTenant(device.tenantId, async (client) => {
      const current = await findDeviceByTokenHash(client, hashToken(token));
      if (current?.device_id !== device.deviceId) throw revokedTokenError();
      const { rowCount } = await client.query(
        `SELECT 1 FROM machines m JOIN tenants t ON t.id = m.tenant_id
         WHERE m.id = $1 AND m.tenant_id = $2 AND m.deleted_at IS NULL
           AND m.lifecycle_state = 'active' AND t.deleted_at IS NULL AND t.machine_control_enabled`,
        [device.machineId, device.tenantId],
      );
      if (!rowCount) {
        throw new ForbiddenException({
          code: 'remote_support_unavailable_for_machine',
          message: 'Remote support is unavailable for this machine.',
        });
      }
      return work(client);
    });
  }
}
