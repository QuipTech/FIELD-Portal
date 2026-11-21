"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toApiErrorMessage } from "../api/apiErrorMessage";
import {
  completeRecordingRequest,
  createRemoteSessionRequest,
  endRemoteSessionOnUnload,
  endRemoteSessionRequest,
  getRemoteConnectionRequest,
  getRemoteSessionRequest,
  remoteHeartbeatRequest,
  uploadRecordingPartRequest,
} from "../api/remoteSessionApi";
import { isOpenRemoteSession, type RemoteSession } from "../types/remoteSession";
import type { ControlMessage } from "./controlInput";
import { RemoteViewerConnection, type ViewerConnectionState } from "./remoteViewerConnection";
import { describeError, remoteLog } from "./remoteDebugLog";
import { SessionRecorder } from "./sessionRecorder";

const sessionSummary = (session: RemoteSession) => ({
  sessionId: session.id,
  status: session.status,
  deviceId: session.deviceId,
  control: session.scope.control,
  record: session.scope.record,
  expiresAt: session.expiresAt,
  endReason: session.endReason,
  endedBy: session.endedBy,
});

export type RemotePhase = "requesting" | "waiting" | "connecting" | "live" | "ended" | "error";

const WAITING_POLL_MS = 1500;
// How long ending waits for the last recording part to upload while the
// session is still active, before ending it anyway.
const FINAL_UPLOAD_WAIT_MS = 30_000;
const MAX_RECONNECTS = 3;

// One remote session from this window: Connect, wait for the operator's
// answer, then view, control and record until either side ends it.
export const useRemoteSession = (machineId: string) => {
  const [phase, setPhase] = useState<RemotePhase>("requesting");
  const [session, setSession] = useState<RemoteSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [connectionState, setConnectionState] = useState<ViewerConnectionState>("connecting");
  const [controlReady, setControlReady] = useState(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [micPending, setMicPending] = useState(false);

  const started = useRef(false);
  const sessionRef = useRef<RemoteSession | null>(null);
  const connection = useRef<RemoteViewerConnection | null>(null);
  const recorder = useRef<SessionRecorder | null>(null);
  const mic = useRef<MediaStream | null>(null);
  const changingMic = useRef(false);
  const interacted = useRef(false);
  const reconnects = useRef(0);
  const finishing = useRef<Promise<void> | null>(null);

  const remember = useCallback((next: RemoteSession) => {
    sessionRef.current = next;
    setSession(next);
  }, []);

  // Stops the media, keeps the recording, and shows the end screen.
  const finish = useCallback(
    (endOnServer: boolean) => {
      finishing.current ??= (async () => {
        const current = sessionRef.current;
        remoteLog.info("session: finishing", { endOnServer, ...(current ? sessionSummary(current) : {}) });
        const stopRecording = recorder.current?.stop() ?? Promise.resolve(false);
        connection.current?.close();
        mic.current?.getTracks().forEach((track) => track.stop());
        mic.current = null;
        setMicOn(false);
        setStream(null);
        setIsRecording(false);
        // Upload the last part before ending: a short session's only part
        // is uploaded here, and the backend takes it most reliably while
        // the session is still active.
        let uploaded: boolean | null = null;
        if (recorder.current) {
          remoteLog.info("recording: stopping; uploading the last part before ending the session");
          uploaded = await Promise.race([
            stopRecording,
            new Promise<null>((done) => setTimeout(() => done(null), FINAL_UPLOAD_WAIT_MS)),
          ]);
          if (uploaded === null) remoteLog.warn("recording: last part still uploading after 30 s; ending the session anyway");
        }
        if (current && endOnServer) {
          await endRemoteSessionRequest(machineId, current.id)
            .then(remember)
            .catch(() => undefined);
        }
        uploaded ??= await stopRecording;
        if (recorder.current) remoteLog[uploaded ? "info" : "error"]("recording: upload finished", { uploaded });
        if (current && recorder.current) {
          await completeRecordingRequest(machineId, current.id, !uploaded)
            .then(remember)
            .catch(() => undefined);
        }
        if (current) {
          await getRemoteSessionRequest(machineId, current.id)
            .then(remember)
            .catch(() => undefined);
        }
        if (sessionRef.current) remoteLog.info("session: ended", sessionSummary(sessionRef.current));
        setPhase("ended");
      })();
      return finishing.current;
    },
    [machineId, remember],
  );

  const startRecording = useCallback(
    (media: MediaStream) => {
      const current = sessionRef.current;
      if (!current?.scope.record || recorder.current || media.getVideoTracks().length === 0) return;
      if (!SessionRecorder.isSupported()) {
        remoteLog.error("recording: this browser can't record (MediaRecorder/AudioContext missing)");
        setRecordingError("This browser can't record the session. Use a current Chrome or Edge.");
        return;
      }
      const sessionRecorder = new SessionRecorder(
        (partNumber, part) =>
          uploadRecordingPartRequest(machineId, current.id, partNumber, part).then(
            (result) => {
              remoteLog.info("recording: part uploaded", { partNumber, bytes: part.size });
              return result;
            },
            (uploadError: unknown) => {
              remoteLog.warn("recording: part upload failed", { partNumber, bytes: part.size, ...describeError(uploadError) });
              throw uploadError;
            },
          ),
        (message) => {
          remoteLog.error("recording: failed", { message });
          setRecordingError(message);
        },
      );
      recorder.current = sessionRecorder;
      remoteLog.info("recording: started (first video track arrived)", { sessionId: current.id });
      sessionRecorder.start(media);
      if (mic.current) sessionRecorder.addAudio(mic.current);
      setIsRecording(sessionRecorder.isRecording);
    },
    [machineId],
  );

  const connect = useCallback(async () => {
    const current = sessionRef.current;
    if (current?.status !== "active" || finishing.current) return;
    setPhase("connecting");
    remoteLog.info("session: requesting viewer signaling connection", { sessionId: current.id, attempt: reconnects.current + 1 });
    try {
      const access = await getRemoteConnectionRequest(machineId, current.id);
      remoteLog.info("session: viewer signaling connection issued", { sessionId: access.sessionId, role: access.role, expiresAt: access.expiresAt });
      if (finishing.current || sessionRef.current?.status !== "active") return;
      connection.current?.close();
      const viewer = new RemoteViewerConnection(access, {
        onStream: (media) => {
          setStream(media);
          startRecording(media);
          recorder.current?.addAudio(media);
        },
        onState: (state) => {
          setConnectionState(state);
          if (state === "connected") {
            reconnects.current = 0;
            setPhase("live");
          }
          if (state === "failed" && !finishing.current) {
            if (reconnects.current < MAX_RECONNECTS) {
              reconnects.current += 1;
              remoteLog.warn("session: viewer failed, reconnecting", { attempt: reconnects.current, max: MAX_RECONNECTS });
              void connect();
            } else {
              remoteLog.error("session: gave up after reconnects", { max: MAX_RECONNECTS });
              setError("Lost the connection to the tablet.");
            }
          }
        },
        onControlReady: setControlReady,
      });
      connection.current = viewer;
      viewer.start();
      if (mic.current) await viewer.setMicrophone(mic.current.getAudioTracks()[0] ?? null);
    } catch (connectError) {
      remoteLog.error("session: couldn't get the viewer signaling connection (backend /connection)", describeError(connectError));
      setError(toApiErrorMessage(connectError, "Couldn't connect to the tablet."));
    }
  }, [machineId, startRecording]);

  // Connect once (StrictMode runs effects twice in development).
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    remoteLog.info("session: creating remote session (Connect)", { machineId });
    createRemoteSessionRequest(machineId, true)
      .then((created) => {
        remoteLog.info("session: created; waiting for the tablet operator to Allow", sessionSummary(created));
        remember(created);
        setPhase("waiting");
      })
      .catch((createError) => {
        remoteLog.error("session: create failed", describeError(createError));
        setError(toApiErrorMessage(createError, "Couldn't start a remote session."));
        setPhase("error");
      });
  }, [machineId, remember]);

  // Waiting for Allow or Decline.
  useEffect(() => {
    if (phase !== "waiting" || !session) return;
    let current = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const next = await getRemoteSessionRequest(machineId, session.id);
        if (!current) return;
        if (next.status !== sessionRef.current?.status) remoteLog.info("session: status changed", sessionSummary(next));
        remember(next);
        if (next.status === "active") {
          void connect();
          return;
        }
        if (!isOpenRemoteSession(next.status)) {
          setPhase("ended");
          return;
        }
      } catch (pollError) {
        remoteLog.warn("session: status poll failed; retrying", describeError(pollError));
      }
      if (current) timer = setTimeout(poll, WAITING_POLL_MS);
    };
    timer = setTimeout(poll, WAITING_POLL_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [phase, session, machineId, remember, connect]);

  // Heartbeats while the session runs; they also notice the tablet ending it.
  const sessionId = session?.id;
  const heartbeatSeconds = session?.heartbeatSeconds ?? 15;
  const running = phase === "connecting" || phase === "live";
  useEffect(() => {
    if (!running || !sessionId) return;
    const timer = setInterval(async () => {
      const wasInteracted = interacted.current;
      interacted.current = false;
      try {
        const next = await remoteHeartbeatRequest(machineId, sessionId, wasInteracted);
        if (next.status !== sessionRef.current?.status) remoteLog.info("session: status changed (heartbeat)", sessionSummary(next));
        remember(next);
        if (!isOpenRemoteSession(next.status)) void finish(false);
      } catch (heartbeatError) {
        remoteLog.warn("session: heartbeat failed", describeError(heartbeatError));
        interacted.current ||= wasInteracted;
      }
    }, heartbeatSeconds * 1000);
    return () => clearInterval(timer);
  }, [running, sessionId, heartbeatSeconds, machineId, remember, finish]);

  // Closing the window ends the session.
  useEffect(() => {
    const onHide = () => {
      const current = sessionRef.current;
      if (current && isOpenRemoteSession(current.status) && !finishing.current) {
        endRemoteSessionOnUnload(machineId, current.id);
      }
    };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [machineId]);

  const sendControl = useCallback((message: ControlMessage) => {
    if (finishing.current || sessionRef.current?.status !== "active" || !sessionRef.current.scope.control) return;
    if (connection.current?.send(message)) interacted.current = true;
  }, []);

  const toggleMic = useCallback(async () => {
    if (changingMic.current || finishing.current || sessionRef.current?.status !== "active") return;
    changingMic.current = true;
    setMicPending(true);
    try {
      if (mic.current) {
        mic.current.getTracks().forEach((track) => track.stop());
        mic.current = null;
        setMicOn(false);
        await connection.current?.setMicrophone(null);
        return;
      }
      const media = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      if (finishing.current || sessionRef.current?.status !== "active") {
        media.getTracks().forEach((track) => track.stop());
        return;
      }
      mic.current = media;
      await connection.current?.setMicrophone(media.getAudioTracks()[0] ?? null);
      if (mic.current !== media) return;
      recorder.current?.addAudio(media);
      setMicOn(true);
    } catch {
      mic.current?.getTracks().forEach((track) => track.stop());
      mic.current = null;
      setMicOn(false);
      if (!finishing.current) setError("Couldn't use your microphone. Check the browser's permission for this site.");
    } finally {
      changingMic.current = false;
      setMicPending(false);
    }
  }, []);

  const end = useCallback(() => {
    const current = sessionRef.current;
    if (!current) return Promise.resolve();
    return finish(isOpenRemoteSession(current.status));
  }, [finish]);

  return {
    phase,
    session,
    error,
    stream,
    connectionState,
    controlReady,
    isRecording,
    recordingError,
    micOn,
    micPending,
    resumeRecordingAudio: () => recorder.current?.resumeAudio(),
    sendControl,
    toggleMic,
    end,
    clearError: () => setError(null),
  };
};
