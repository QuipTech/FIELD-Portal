import type { RemoteSession, RemoteSignalingConnection, RemoteTranscript } from "../types/remoteSession";
import { API_BASE_URL, CLIENT_HEADERS, apiRequest } from "./httpClient";
import { requireAccessToken } from "./requireAccessToken";

const sessionsPath = (machineId: string) => `/machines/${machineId}/remote-sessions`;
const sessionPath = (machineId: string, sessionId: string) => `${sessionsPath(machineId)}/${sessionId}`;
const authorization = () => ({ Authorization: `Bearer ${requireAccessToken()}` });

// Connect: the machine's tablet asks its operator to Allow or Decline.
export const createRemoteSessionRequest = (machineId: string, control = true): Promise<RemoteSession> =>
  apiRequest<RemoteSession>(sessionsPath(machineId), {
    method: "POST",
    headers: authorization(),
    body: JSON.stringify({ control }),
  });

export const getRemoteSessionRequest = (machineId: string, sessionId: string): Promise<RemoteSession> =>
  apiRequest<RemoteSession>(sessionPath(machineId, sessionId), { headers: authorization(), cache: "no-store" });

export const getRemoteConnectionRequest = (machineId: string, sessionId: string): Promise<RemoteSignalingConnection> =>
  apiRequest<RemoteSignalingConnection>(`${sessionPath(machineId, sessionId)}/connection`, {
    method: "POST",
    headers: authorization(),
  });

export const remoteHeartbeatRequest = (machineId: string, sessionId: string, interacted: boolean): Promise<RemoteSession> =>
  apiRequest<RemoteSession>(`${sessionPath(machineId, sessionId)}/heartbeat`, {
    method: "POST",
    headers: authorization(),
    body: JSON.stringify({ interacted }),
  });

export const endRemoteSessionRequest = (machineId: string, sessionId: string): Promise<RemoteSession> =>
  apiRequest<RemoteSession>(`${sessionPath(machineId, sessionId)}/end`, { method: "POST", headers: authorization() });

// For a window that is closing: keepalive lets the request outlive the page.
export const endRemoteSessionOnUnload = (machineId: string, sessionId: string) => {
  try {
    void fetch(`${API_BASE_URL}${sessionPath(machineId, sessionId)}/end`, {
      method: "POST",
      keepalive: true,
      headers: { ...CLIENT_HEADERS, ...authorization() },
    });
  } catch {
    // The backend ends it after 60 seconds without heartbeats anyway.
  }
};

export const uploadRecordingPartRequest = (machineId: string, sessionId: string, partNumber: number, part: Blob) => {
  const body = new FormData();
  body.append("part", part, `part-${partNumber}.webm`);
  return apiRequest<{ part: number; bytes: number }>(`${sessionPath(machineId, sessionId)}/recording/parts/${partNumber}`, {
    method: "PUT",
    headers: authorization(),
    body,
  });
};

export const completeRecordingRequest = (machineId: string, sessionId: string, failed = false): Promise<RemoteSession> =>
  apiRequest<RemoteSession>(`${sessionPath(machineId, sessionId)}/recording/complete`, {
    method: "POST",
    headers: authorization(),
    body: JSON.stringify({ failed }),
  });

export const getRecordingUrlRequest = (machineId: string, sessionId: string) =>
  apiRequest<{ url: string; expiresAt: string }>(`${sessionPath(machineId, sessionId)}/recording`, {
    headers: authorization(),
    cache: "no-store",
  });

export const getTranscriptRequest = (machineId: string, sessionId: string): Promise<RemoteTranscript> =>
  apiRequest<RemoteTranscript>(`${sessionPath(machineId, sessionId)}/transcript`, { headers: authorization(), cache: "no-store" });

// Admins (mc.remote_delete), once the session has ended: the recording and
// transcript only; the session stays in History.
export const deleteRemoteRecordingRequest = (machineId: string, sessionId: string): Promise<RemoteSession> =>
  apiRequest<RemoteSession>(`${sessionPath(machineId, sessionId)}/recording`, { method: "DELETE", headers: authorization() });

// Admins: the recording, and the session removed from the machine's History.
export const deleteRemoteSessionRequest = (machineId: string, sessionId: string): Promise<RemoteSession> =>
  apiRequest<RemoteSession>(sessionPath(machineId, sessionId), { method: "DELETE", headers: authorization() });
