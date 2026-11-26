// Remote support on a machine's tablet (backend migration 0139).
export type RemoteSessionStatus = "requested" | "active" | "declined" | "expired" | "cancelled" | "ended";
export type RemoteRecordingStatus = "pending" | "recording" | "completed" | "failed" | "none";
export type RemoteTranscriptStatus = "none" | "processing" | "completed" | "failed";

export interface RemoteSession {
  id: string;
  machineId: string;
  deviceId: string;
  status: RemoteSessionStatus;
  // "unattended": opened with the tablet's password, nothing to Allow.
  access?: "prompt" | "unattended";
  requester: { name: string };
  scope: { view: true; control: boolean; record: boolean };
  createdAt: string;
  expiresAt: string;
  startedAt: string | null;
  endedAt: string | null;
  endReason: string | null;
  endedBy: "portal" | "tablet" | "system" | null;
  durationSeconds: number | null;
  recording: { status: RemoteRecordingStatus; error: string | null };
  transcript: { status: RemoteTranscriptStatus };
  heartbeatSeconds: number;
  inactivityMinutes: number;
}

export interface RemoteSignalingConnection {
  sessionId: string;
  role: "MASTER" | "VIEWER";
  region: string;
  channelArn: string;
  clientId: string | null;
  viewerClientId: string;
  signalingUrl: string;
  iceServers: RTCIceServer[];
  expiresAt: string;
  controlAllowed: boolean;
}

export interface RemoteTranscript {
  status: RemoteTranscriptStatus;
  text: string | null;
  error: string | null;
}

// On a machine history entry of type "remote_session".
export interface RemoteSessionSummary {
  id: string;
  requesterName: string;
  startedAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  endReason: string | null;
  recordingStatus: RemoteRecordingStatus;
  transcriptStatus: RemoteTranscriptStatus;
}

export const isOpenRemoteSession = (status: RemoteSessionStatus) => status === "requested" || status === "active";

const END_REASON_LABELS: Record<string, string> = {
  portal_ended: "Ended from the Portal",
  tablet_ended: "Ended on the tablet",
  declined: "The operator declined",
  expired: "Nobody answered in time",
  cancelled: "Cancelled",
  inactive: "Ended after 10 minutes without activity",
  viewer_lost: "The Portal window stopped responding",
  tablet_lost: "The tablet stopped responding",
  unpaired: "The tablet was disconnected",
  max_duration: "Reached the 4-hour limit",
};

export const remoteEndReasonLabel = (reason: string | null) =>
  (reason && END_REASON_LABELS[reason]) || "Session ended";

// "12 min 5 s".
export const formatRemoteDuration = (seconds: number | null) => {
  if (seconds === null) return "";
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes ? `${minutes} min ${rest} s` : `${rest} s`;
};
