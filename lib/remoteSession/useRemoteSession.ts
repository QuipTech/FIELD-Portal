"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
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
// A connection "disconnected" this long is treated as lost and reconnected
// (the tablet stopped sharing, or its network dropped).
const DISCONNECTED_RECONNECT_MS = 8000;

// One remote session from this window: Connect, wait for the operator's
// answer, then view, control and record until either side ends it.
// `videoElement`: the page's <video> showing the tablet, which the recording
// copies its frames from.
export const useRemoteSession = (
  machineId: string,
  videoElement?: RefObject<HTMLVideoElement | null>,
  // Already running (opened with the tablet's password): connect straight
  // away and record without waiting for "Start recording".
  startedSession?: RemoteSession,
) => {
  const [phase, setPhase] = useState<RemotePhase>("requesting");
  const [session, setSession] = useState<RemoteSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [connectionState, setConnectionState] = useState<ViewerConnectionState>("connecting");
  const [controlReady, setControlReady] = useState(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  // Recording starts only when the viewer clicks "Start recording"; true
  // once it has (a later Stop only pauses it).
  const [hasRecorded, setHasRecorded] = useState(false);
  // The viewer wants it recording (Start, until Stop). While the tablet
  // isn't sharing its screen the recorder pauses anyway, so no black
  // stretch is recorded, and carries on when the picture is back.
  const [wantsRecording, setWantsRecording] = useState(
    () => startedSession?.access === "unattended" && startedSession.scope.record,
  );
  // Recording waits for a click in this window to start the sound.
  const [recordingNeedsClick, setRecordingNeedsClick] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [micPending, setMicPending] = useState(false);
  // The tablet's video track is muted: it stopped sending its screen.
  const [videoPaused, setVideoPaused] = useState(false);

  const started = useRef(false);
  const sessionRef = useRef<RemoteSession | null>(null);
  const connection = useRef<RemoteViewerConnection | null>(null);
  const recorder = useRef<SessionRecorder | null>(null);
  // The tablet's latest stream, which "Start recording" records.
  const latestMedia = useRef<MediaStream | null>(null);
  const mic = useRef<MediaStream | null>(null);
  const changingMic = useRef(false);
  const interacted = useRef(false);
  const reconnects = useRef(0);
  const disconnectedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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
        if (disconnectedTimer.current !== null) clearTimeout(disconnectedTimer.current);
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

  const createRecorder = useCallback(
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
          setIsRecording(false);
        },
        (recording) => {
          remoteLog.info(recording ? "recording: recorder running" : "recording: recorder stopped");
          setIsRecording(recording);
        },
        () => videoElement?.current ?? null,
        (waiting) => {
          if (waiting) remoteLog.warn("recording: waiting for a click in this window to start sound (browser autoplay rule); video-only after 10 s");
          setRecordingNeedsClick(waiting);
        },
      );
      recorder.current = sessionRecorder;
      remoteLog.info("recording: started by the user", { sessionId: current.id });
      sessionRecorder.start(media);
      if (mic.current) sessionRecorder.addAudio(mic.current);
    },
    [machineId, videoElement],
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
          const videoTrack = media.getVideoTracks()[0];
          if (videoTrack) {
            setVideoPaused(videoTrack.muted);
            videoTrack.onmute = () => {
              remoteLog.warn("viewer: tablet video paused (it stopped sending its screen)");
              setVideoPaused(true);
            };
            videoTrack.onunmute = () => {
              remoteLog.info("viewer: tablet video resumed");
              setVideoPaused(false);
            };
          } else {
            // No screen from the tablet yet: nothing to record.
            setVideoPaused(true);
          }
          latestMedia.current = media;
          // After a reconnect, the recording carries on with the new video.
          recorder.current?.setVideo(videoTrack);
          recorder.current?.addAudio(media);
        },
        onState: (state) => {
          setConnectionState(state);
          if (disconnectedTimer.current !== null) clearTimeout(disconnectedTimer.current);
          disconnectedTimer.current = null;
          if (state === "connected") {
            reconnects.current = 0;
            setError(null);
            setPhase("live");
          }
          if (state === "disconnected" && !finishing.current) {
            disconnectedTimer.current = setTimeout(() => {
              if (finishing.current || connection.current !== viewer) return;
              remoteLog.warn("session: disconnected for 8 s; reconnecting");
              reconnects.current = 0;
              void connect();
            }, DISCONNECTED_RECONNECT_MS);
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
  }, [machineId]);

  // Connect once (StrictMode runs effects twice in development).
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (startedSession) {
      remember(startedSession);
      void connect();
      return;
    }
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
  }, [machineId, remember, startedSession, connect]);

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

  // Any click or key press in this window lets the browser start the
  // recording's sound (its autoplay rule needs one).
  useEffect(() => {
    const resume = () => void recorder.current?.resumeAudio();
    window.addEventListener("pointerdown", resume, true);
    window.addEventListener("keydown", resume, true);
    return () => {
      window.removeEventListener("pointerdown", resume, true);
      window.removeEventListener("keydown", resume, true);
    };
  }, []);

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

  // Debug only: how many control messages went to the tablet, by type.
  const controlSent = useRef<Record<string, number>>({});
  const sendControl = useCallback((message: ControlMessage) => {
    if (finishing.current || sessionRef.current?.status !== "active" || !sessionRef.current.scope.control) return;
    const sent = Boolean(connection.current?.send(message));
    if (sent) interacted.current = true;
    // Log clicks, keys and text (not every mouse move) so the tablet's side
    // can be checked against what the Portal sent.
    const isMove = message.type === "pointer" && message.action === "move";
    if (!isMove) {
      const kind = message.type === "pointer" ? `pointer ${message.action}` : message.type;
      controlSent.current[kind] = (controlSent.current[kind] ?? 0) + 1;
      (sent ? remoteLog.info : remoteLog.warn)(sent ? "control: sent to tablet" : "control: NOT sent (data channel closed)", {
        kind,
        ...(message.type === "pointer" || message.type === "wheel" ? { x: message.x, y: message.y } : {}),
        ...(message.type === "key" ? { code: message.code } : {}),
        totals: { ...controlSent.current },
      });
    }
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

  // The Reconnect button: a fresh signaling connection and offer, for when
  // the tablet shared its screen again or the picture froze.
  const reconnect = useCallback(() => {
    if (finishing.current || sessionRef.current?.status !== "active") return;
    remoteLog.info("session: reconnect requested by the user");
    reconnects.current = 0;
    setError(null);
    setVideoPaused(false);
    void connect();
  }, [connect]);

  // "Start recording": the first click starts the recorder (the click also
  // lets the browser record sound); after a Pause it carries on in the same
  // file. The file is saved to History when the session ends. Nothing is
  // recorded before this click.
  const startRecording = useCallback(() => {
    if (finishing.current || sessionRef.current?.status !== "active") return;
    setWantsRecording(true);
    if (recorder.current) {
      remoteLog.info("recording: resumed by the user");
      void recorder.current.resumeAudio();
      if (!videoPaused) recorder.current.resume();
      return;
    }
    if (!latestMedia.current || videoPaused) return;
    remoteLog.info("recording: started by the user");
    createRecorder(latestMedia.current);
    if (recorder.current) setHasRecorded(true);
  }, [createRecorder, videoPaused]);

  // "Pause recording": Start carries on in the same recording.
  const stopRecording = useCallback(() => {
    setWantsRecording(false);
    if (finishing.current || !recorder.current) return;
    remoteLog.info("recording: paused by the user");
    recorder.current.pause();
  }, []);

  // While the tablet isn't sharing its screen, pause instead of recording
  // black; carry on (or begin, if Start was pressed meanwhile) once its
  // picture is back.
  useEffect(() => {
    if (!wantsRecording || finishing.current) return;
    if (videoPaused) {
      if (recorder.current?.isRecording) {
        remoteLog.info("recording: paused while the tablet isn't sharing its screen");
        recorder.current.pause();
      }
      return;
    }
    if (recorder.current) {
      if (recorder.current.isPaused) {
        remoteLog.info("recording: carrying on, the tablet's screen is back");
        recorder.current.resume();
      }
      return;
    }
    if (latestMedia.current) {
      createRecorder(latestMedia.current);
      if (recorder.current) setHasRecorded(true);
    }
  }, [wantsRecording, videoPaused, stream, createRecorder]);

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
    recordingNeedsClick,
    hasRecorded,
    // Start was pressed, but the tablet isn't sharing its screen yet.
    recordingWaitsForScreen: wantsRecording && videoPaused,
    canRecord: Boolean(session?.scope.record && stream),
    startRecording,
    stopRecording,
    recordingError,
    micOn,
    micPending,
    videoPaused,
    reconnect,
    resumeRecordingAudio: () => recorder.current?.resumeAudio(),
    sendControl,
    toggleMic,
    end,
    clearError: () => setError(null),
  };
};
