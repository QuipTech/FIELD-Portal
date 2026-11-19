import { IsBoolean, IsIn, IsOptional, IsUUID } from 'class-validator';

// How long the operator has to Allow or Decline.
export const REMOTE_REQUEST_SECONDS = 60;
// No interaction (viewer input or local touch on the tablet) for this long
// ends the session.
export const REMOTE_INACTIVE_MINUTES = 10;
// Both sides heartbeat every 15 seconds; missing this long means gone.
export const REMOTE_LOST_SECONDS = 60;
export const REMOTE_MAX_MINUTES = 4 * 60;
export const REMOTE_HEARTBEAT_SECONDS = 15;
// A recording the viewer never finished is completed from its uploaded
// parts this long after the session closed.
export const REMOTE_RECORDING_GRACE_SECONDS = 120;
// S3 multipart rules: every part but the last is at least 5 MiB.
export const REMOTE_MIN_PART_BYTES = 5 * 1024 * 1024;
export const REMOTE_MAX_PART_BYTES = 32 * 1024 * 1024;
export const REMOTE_MAX_PARTS = 2000;

export type RemoteSessionStatus =
  | 'requested'
  | 'active'
  | 'declined'
  | 'expired'
  | 'cancelled'
  | 'ended';

export type RemoteRecordingStatus =
  | 'pending'
  | 'recording'
  | 'completed'
  | 'failed'
  | 'none';

export type RemoteTranscriptStatus =
  | 'none'
  | 'processing'
  | 'completed'
  | 'failed';

export interface RemoteSessionRow {
  id: string;
  tenant_id: string;
  machine_id: string;
  device_id: string;
  initiated_by: 'portal' | 'tablet';
  requester_id: string | null;
  requester_tenant_id: string;
  requester_name: string;
  status: RemoteSessionStatus;
  control_requested: boolean;
  control_granted: boolean;
  record: boolean;
  viewer_client_id: string;
  channel_name: string | null;
  channel_arn: string | null;
  channel_deleted_at: Date | null;
  created_at: Date;
  expires_at: Date;
  decided_at: Date | null;
  started_at: Date | null;
  ended_at: Date | null;
  end_reason: string | null;
  ended_by: 'portal' | 'tablet' | 'system' | null;
  last_activity_at: Date | null;
  recording_status: RemoteRecordingStatus;
  recording_key: string | null;
  recording_upload_id: string | null;
  recording_parts: { part: number; etag: string; bytes: number }[];
  recording_bytes: string | number;
  recording_error: string | null;
  transcript_status: RemoteTranscriptStatus;
  transcript_job: string | null;
  transcript_text: string | null;
  transcript_error: string | null;
}

// What both the Portal and the tablet get for a session.
export interface RemoteSession {
  id: string;
  machineId: string;
  deviceId: string;
  status: RemoteSessionStatus;
  initiatedBy: 'portal' | 'tablet';
  requester: { name: string };
  scope: { view: true; control: boolean; record: boolean };
  createdAt: string;
  expiresAt: string;
  startedAt: string | null;
  endedAt: string | null;
  endReason: string | null;
  endedBy: 'portal' | 'tablet' | 'system' | null;
  durationSeconds: number | null;
  recording: { status: RemoteRecordingStatus; error: string | null };
  transcript: { status: RemoteTranscriptStatus };
  heartbeatSeconds: number;
  inactivityMinutes: number;
}

const iso = (value: Date | null) =>
  value ? new Date(value).toISOString() : null;

export const toRemoteSession = (row: RemoteSessionRow): RemoteSession => {
  const started = row.started_at ? new Date(row.started_at).getTime() : null;
  const ended = row.ended_at ? new Date(row.ended_at).getTime() : Date.now();
  return {
    id: row.id,
    machineId: row.machine_id,
    deviceId: row.device_id,
    status: row.status,
    initiatedBy: row.initiated_by,
    requester: { name: row.requester_name },
    scope: {
      view: true,
      control:
        row.status === 'requested' ? row.control_requested : row.control_granted,
      record: row.record,
    },
    createdAt: iso(row.created_at)!,
    expiresAt: iso(row.expires_at)!,
    startedAt: iso(row.started_at),
    endedAt: iso(row.ended_at),
    endReason: row.end_reason,
    endedBy: row.ended_by,
    durationSeconds:
      started === null ? null : Math.max(0, Math.floor((ended - started) / 1000)),
    recording: { status: row.recording_status, error: row.recording_error },
    transcript: { status: row.transcript_status },
    heartbeatSeconds: REMOTE_HEARTBEAT_SECONDS,
    inactivityMinutes: REMOTE_INACTIVE_MINUTES,
  };
};

// One side's way onto the session's signaling channel.
export interface RemoteSignalingConnection {
  sessionId: string;
  role: 'MASTER' | 'VIEWER';
  region: string;
  channelArn: string;
  // The viewer's own client id; for the tablet, the only viewer to answer.
  clientId: string | null;
  viewerClientId: string;
  // A presigned wss:// URL, good for opening the socket until expiresAt.
  signalingUrl: string;
  iceServers: { urls: string[]; username?: string; credential?: string }[];
  expiresAt: string;
  controlAllowed: boolean;
}

export class CreateRemoteSessionDto {
  @IsOptional()
  @IsBoolean()
  control?: boolean;
}

export class RemoteDecisionDto {
  @IsIn(['allow', 'decline'])
  decision!: 'allow' | 'decline';

  // The operator may allow viewing only.
  @IsOptional()
  @IsBoolean()
  allowControl?: boolean;
}

export class RemoteHeartbeatDto {
  @IsOptional()
  @IsBoolean()
  interacted?: boolean;
}

export class RemoteRecordingCompleteDto {
  @IsOptional()
  @IsBoolean()
  failed?: boolean;
}

export class RequestRemoteHelpDto {
  @IsUUID('4')
  requestId!: string;

  // Control requires an explicit operator choice when requesting help.
  @IsBoolean()
  control!: boolean;
}
